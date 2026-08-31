# Changes — OTP verification page after phone registration (web)

## Mid-session discovery (read this first)

An earlier interrupted run of this same ship left **commit `c9afe97`** on branch
`feat/otp-verification-screen` ("feat(web): add /otp phone verification screen
after register (mock-wired)", 2026-08-17 18:26:55). It contained a mock-wired
OTP screen: hardcoded `"123456"` acceptance, redirect to `/login`, server-side
`searchParams` page, no backend calls.

This pass replaces that mock wiring with the spec-compliant real-API
implementation below, layered as working-tree changes on top of `c9afe97`.
Nothing from the mock version is lost that the spec wants kept:

- Same route (`/[locale]/(user)/(auth)/otp`) and same `"/otp": {}` routing
  entry (byte-identical — `routing.ts` has no diff vs HEAD).
- The register page JSX/design is untouched (c9afe97 didn't change it either).
- The old `components/auth/OtpForm.tsx` (Telegram-themed, pre-existing) is
  still untouched.

## Files modified / created

| File                                               | Change                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/lib/phone.ts`                            | **NEW** — `normalizePhone()`: local `0XXXXXXXXX` → E.164 `+855XXXXXXXXX`; `+…` passthrough; `""` when < 8 digits. Shared by register action + OTP page so both keys match.                                                                                                                                       |
| `apps/web/actions/otp.ts`                          | **NEW** — `requestOtp()` → `POST /auth/otp/request`; `verifyOtp()` → `POST /auth/otp/verify` + `setUserSession()` on success (mirrors `actions/login.ts`).                                                                                                                                                       |
| `apps/web/actions/register.ts`                     | Mock → real: zod gate, phone normalization, `POST /auth/register { phone }`, returns `{ success: true, phone }` (E.164) on `{ otpSent: true }`.                                                                                                                                                                  |
| `apps/web/components/auth/OtpVerifyForm.tsx`       | **REWRITTEN from c9afe97's mock** — single `InputOTPGroup` of 6 one-digit slots (shadcn `input-otp`, already a dep), auto-submit on 6th digit, in-flight/done refs against double-submit, 60 s resend cooldown calling the real resend endpoint, error toasts with input clear, auto-login → `router.push("/")`. |
| `apps/web/components/auth/OtpPageClient.tsx`       | **NEW** — client shim: `useSearchParams()` → `normalizePhone`; invalid/missing `?phone` → `router.replace("/register")`.                                                                                                                                                                                         |
| `apps/web/app/[locale]/(user)/(auth)/otp/page.tsx` | c9afe97's server-`searchParams` version → server page rendering `<Suspense>`-wrapped `OtpPageClient` (matches repo convention of client-side `useSearchParams`).                                                                                                                                                 |
| `apps/web/components/auth/RegisterForm.tsx`        | Submit wiring only (per spec Decision 8): `useRouter` from `@/i18n/routing`, `register(value)`, on success "Code sent" toast + `router.push({ pathname: "/otp", query: { phone } })`; JSON-dump toast removed. Zero JSX/design changes.                                                                          |
| `apps/web/i18n/routing.ts`                         | No net diff (identical `/otp` entry already in HEAD).                                                                                                                                                                                                                                                            |

## Behavioral diff

| Behavior              | Before (HEAD = mock)                                          | After                                                                                            |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Register submit       | (pre-c9afe97: mock toast only) / c9afe97: navigates to `/otp` | Real `POST /auth/register` (sends SMS OTP) → toast → navigate to `/otp?phone=+855…`              |
| OTP entry             | 6 boxes, hardcoded `"123456"`                                 | 6 boxes, real `POST /auth/otp/verify`                                                            |
| Wrong code            | local string compare                                          | backend error message → toast + clear + retry                                                    |
| Success               | toast + push `/login`                                         | `user_access_token`/`user_refresh_token` httpOnly cookies set (server action) + toast + push `/` |
| Resend                | none in mock (static button in old OtpForm)                   | `POST /auth/otp/request` with 60 s cooldown                                                      |
| No `?phone` on `/otp` | card saying "No phone number to verify"                       | redirect to `/register`                                                                          |
| Phone format          | raw local string in URL                                       | normalized E.164 everywhere (backend rejects leading-0 locals)                                   |

## Not done (per spec non-goals)

- Backend untouched (`git status` confirms no `apps/backend/**` changes).
- No i18n keys (auth surface is hardcoded EN repo-wide — separate ticket).
- No new dependencies (`input-otp@^1.4.2` was already installed).
- `OtpForm.tsx` (Telegram mock) left as-is; orphaned pre-existing code.
- firstName/lastName/password still collected but unused by the backend flow
  (backend phone-OTP register accepts only `phone`).

## Dev usage

Backend must run with `DEV_OTP_TOKEN` set: no SMS is sent, and that fixed
token verifies any phone (e.g. `123456` if configured so). Without it, a real
Supabase SMS setup is required.

## Known risks / deviations from spec

- Spec Decision 8 said the _form_ normalizes the phone; implementation
  normalizes inside the _action_ and returns the normalized phone (single
  source of truth, zod gate stays meaningful on the local-format input).
  Behavior contract unchanged.
- The formatter hook reformatted `RegisterForm.tsx` file-wide (it was not
  prettier-normalized before), inflating the diff; the only semantic change
  is the submit wiring + import.

## R1 (2026-08-18): Cambodia-local phone input

- `apps/web/schemas/register.ts` — phoneNumber rule replaced with
  `z.string().trim().regex(/^0\d{7,9}$/, "Invalid phone number.")`; kills
  the leaked "Too small…" default, rejects letters / `+855…` / missing
  leading 0. `min`/`max` dropped (subsumed).
- `apps/web/lib/phone.ts` — NEW `formatPhoneLocal()` (`+855…` → `0…`;
  non-Cambodian passthrough). `normalizePhone` unchanged.
- `apps/web/components/auth/OtpVerifyForm.tsx` — CardDescription shows
  `formatPhoneLocal(phone)`; wire stays E.164 (display-only change).
- `apps/web/components/auth/RegisterForm.tsx` — phone field gains
  `type="tel"` (mobile keypad; no desktop visual change). Design otherwise
  frozen.
- Behavior notes: errors are blur-gated by form-core (no flash on first
  typing); authoritative trim happens in the action (`safeParse`) +
  `normalizePhone`. Backend: 0 files.

## R2 (2026-08-18): phone+password→OTP login; registration sets password + names + username

Backend (apps/backend):
- `src/auth/dto/verify-otp.dto.ts` — REQUIRED `password` (@MinLength(8)),
  optional `firstName`/`lastName` (@MaxLength(100)).
- `src/auth/dto/login-otp.dto.ts` — NEW: phone (E.164) + password.
- `src/auth/dto/request-otp.dto.ts` — NEW: E.164 phone DTO for the
  previously-untyped `/auth/otp/request`.
- `src/auth/auth.controller.ts` — NEW `POST /auth/otp/login` (@Public);
  `otp/request` now typed via RequestOtpDto.
- `src/auth/auth.service.ts` — `verifyPhoneOtp` reworked: existing-user
  password check BEFORE the Supabase call (wrong password never burns an
  OTP); new-user INSERT extras (bcrypt passwordHash, names,
  `generateUniqueUsername(buildUsernameBase(...))` when names present);
  `mirrorSupabaseUser` optional `insertExtras` param spread ONLY into
  `.values()` — conflict `set` stays `{updatedAt}` (login can never
  overwrite password/names/username). NEW `requestLoginOtp` (unknown phone
  or wrong password → 401, no OTP sent).

Web (apps/web):
- `lib/phone.ts` — NEW `isLocalPhone()` (strict `^0\d{7,9}$`).
- `lib/otp-registration.ts` — NEW sessionStorage handoff (mode
  register|login, phone, password, names; parse-guarded, stale-discard,
  length caps; password NEVER in a URL).
- `actions/otp.ts` — NEW `requestLoginOtp()`; `verifyOtp()` optional
  registration param (body gains password/names; <8 guard).
- `components/auth/RegisterForm.tsx` — stores the register payload before
  redirect (submit-only change).
- `components/auth/OtpVerifyForm.tsx` — mount-guard redirects to /login
  when the handoff is missing; verify carries the payload; clears on
  success; mode-aware back navigation; copy "Enter the code to continue."
- `components/auth/LoginForm.tsx` — submit branch ONLY for local-phone
  identifiers → `requestLoginOtp` → /otp. Zero JSX/design/label changes
  (form correct per captain).

## R3 hotfix (2026-08-18): legacy bare accounts are completed at register

Captain bug report: "register not work with dev-otp". Root cause: six dev-DB
user rows predate the password requirement (`password_hash` NULL) — R2's
verify rejected them (`INVALID_CREDENTIALS`), so re-registering any
already-used phone dead-ended.

Fix (`auth.service.ts` `verifyPhoneOtp`): an existing account whose
`passwordHash` is NULL is COMPLETED in place on OTP verify — possessing the
code proves phone ownership, so the submitted password (+names, +generated
username if still null) fill the account via a guarded UPDATE
(`where id = existing.id and deletedAt is null`). Accounts that already
have a password still require an exact match — credentials are never
replaced through this endpoint. Verified live against the running watch
backend: bare phone → verify success (username/names set) → otp/login with
new password works → wrong password now 401.

## R3b hotfix (2026-08-18): verify body leaked `mode` → backend whitelist 400

Captain bug report: register flow reached the OTP page but verification
failed instantly (6ms). Log evidence: `verifyOtp(…, {mode:"register",…})`.
Root cause: `actions/otp.ts` spread the whole sessionStorage handoff object
into the POST body; the backend's `forbidNonWhitelisted` rejected the
unknown `mode` property with 400 "Validation failed" before any logic ran.

Fix: the verify body now picks fields explicitly
(`phone, token, password?, firstName?, lastName?`). Gates: web lint 0
errors, web build ✓. Live proof against the running backend: fixed body
(fresh phone, names test/four, password test12345) → success,
`username=testfour`; old body with `mode` → 400 "property mode should not
exist". The captain's failed attempt (`+85599888999`) created no row (the
400 fired pre-creation) — a clean retry registers fresh.

## R4 (2026-08-19): user account mode — Phase A (identity, web-only)

- `lib/api/client.ts` — NEW `userServerFetch<T>()` + `tryUserRefresh()`
  (parallel to the admin client; USER cookies; refresh-then-retry once;
  `clearUserSession` on 401 failure; admin client untouched).
- `lib/auth/current-user.ts` — NEW `getCurrentUser(): SessionUser | null`
  (fail-soft; anonymous fast-path returns null without backend round-trip).
- `actions/logout.ts` — NEW `userLogout()` (`clearUserSession` +
  `redirect("/login")`); admin logout untouched.
- `app/[locale]/(user)/layout.tsx` — async layout: `getCurrentUser()` →
  `<NavBar user={user} />`.
- `components/web/NavBar.tsx` — `user: SessionUser | null` prop; removed
  the `localStorage["user"]` mock (never written by the real login);
  `SocialBar user={user}` when logged in.
- `components/web/SocialBar.tsx` — `user` prop; real avatar
  (`profilePhotoUrl` ∨ ui-avatars-from-name), real name/`@username`,
  header item → `/me`, sign out → `userLogout()`.
- `app/[locale]/(user)/me/page.tsx` — real server profile card (names,
  `@username`, local-format phone via `formatPhoneLocal`, member since,
  redirect `/login` when not authed). Mock `me/layout.tsx` header
  ("Thouch Sayi"), the profile subpages, and `lib/user.ts` are OUT OF
  SCOPE (Phase C).

## R4 verification (2026-08-19)

- Gates: `pnpm --filter web build` PASS; `pnpm --filter web lint` PASS
  (0 errors; 1 pre-existing warning in untouched AdminLoginForm.tsx).
  Backend: 0 files changed.
- Instrumentation note: this app's DOM renders client-side; `curl` +
  HTML greps are invalid probes (all content lives in the flight JSON —
  every "error/navbar absent" conclusion from earlier curl runs was an
  artifact). Verification required a real browser via a raw CDP driver
  (chrome-devtools-axi's channel resolver could not locate a Google
  Chrome binary; plain chromium + `node /tmp/cdp.mjs` used instead).
- Browser-verified (logged-in cookie `user_access_token` + real token at
  `http://localhost:3001/en`):
  1. ANON home: navbar shows Login/Register/Sell — unchanged.
  2. LOGGED-IN home: **Login/Register buttons absent**, "Sell" present —
     SocialBar (user chrome) driven by the real session cookie.
  3. LOGGED-IN /en/me: real card `Sok Dara / @sokdara / Member since 18
     Aug 2026 / Phone number 0990000001 / Phone Verified`; logged-in
     navbar. (Mock header "Thouch Sayi" still above — Phase C.)
- The /en 404 scare was a false positive (flight payload boundary
  markers, not a rendered error); the home page renders fine.

## R4b (2026-08-19): post-login redirect → /me (captain)

"after login or register … success as user, then first thing we redirect
user to /me" — post-session redirects point to `/me` instead of `/`:
- `components/auth/LoginForm.tsx` password-login success push → `/me`
- `components/auth/OtpVerifyForm.tsx` verify success push → `/me`
  (covers register→OTP and login→OTP)
Browser-verified E2E via CDP against the running dev app:
- password mode (sokdara/password123): click Login → URL `/en/me`
- phone mode (0990000001/password123): → `/en/otp?phone=%2B855990000001`
  → type 000000 (autofocused input) → `/en/me`
Gates: web build ✓, web lint 0 errors (same 1 pre-existing warning).
