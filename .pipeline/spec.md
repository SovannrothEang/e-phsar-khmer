# OTP verification page after phone registration (web)

## Context

After a user fills the register form and submits, the flow must continue to a
6-digit OTP verification screen that confirms the phone number. The backend
already implements phone-OTP auth (`POST /auth/register` sends the OTP,
`POST /auth/otp/verify` creates the user and returns tokens). This change is
web-only. Mockup-level wiring is approved: real backend calls with graceful
error handling, no new product surfaces beyond the OTP page.

## Current state

- Register page `apps/web/app/[locale]/(user)/(auth)/register/page.tsx` renders
  `RegisterForm` (`apps/web/components/auth/RegisterForm.tsx`), a TanStack Form
  (`useAppForm`) + zod form. Its submit calls `register()` from
  `apps/web/actions/register.ts`, which is a mock: it zod-parses and returns
  `{ success: true }` with no API call. On success the form resets and shows a
  toast that dumps the payload as JSON (RegisterForm.tsx:363-373).
- No OTP page/route exists. `components/auth/OtpForm.tsx` is an unused mock
  component (Telegram copy, `expectedOtp` prop, imported nowhere).
- `input-otp@^1.4.2` is ALREADY a dependency (`apps/web/package.json:24`) and
  the shadcn primitive `components/ui/input-otp.tsx` exists. Using it adds no
  dependency.
- Backend endpoints (`apps/backend/src/auth/auth.controller.ts`):
  - `POST /auth/register` `{ phone }` → `{ otpSent: true }` (line 26)
  - `POST /auth/otp/request` `{ phone }` → `{ otpSent: true }` (line 33) — resend
  - `POST /auth/otp/verify` `{ phone, token }` →
    `{ accessToken, refreshToken, expiresIn, user }` (line 40)
  - Envelope `{ success, data }`; errors `{ success:false, error:{code,message} }`.
  - Phone must match `^\+?[1-9]\d{6,14}$` (leading `0` rejected — the web form
    collects local `0XXXXXXXXX` numbers, so normalization is required).
  - Dev bypass: when `DEV_OTP_TOKEN` env is set, no SMS is sent and only that
    fixed token verifies (`common/supabase/supabase.service.ts:45-59`).
- User session: `setUserSession()` (`apps/web/lib/auth/session.ts:55-59`) sets
  `user_access_token`/`user_refresh_token` httpOnly cookies from a server
  action; `actions/login.ts:22-47` is the plain-fetch + envelope-unwrap pattern
  to copy.
- Routing: `apps/web/proxy.ts` guards only `/wanderer/dashboard/**`; all
  `/[locale]/*` routes are public. Locale-aware navigation comes from
  `@/i18n/routing` (`Link`, `useRouter`); route names must be registered in the
  `pathnames` map (`apps/web/i18n/routing.ts:9-88`) or typed hrefs fail to
  compile.
- Auth pages are hardcoded English (no next-intl keys exist for login/register);
  `messages/*.json` only contain `HomePage` and `Card` namespaces.

## Goal

1. Register submit fires the real `POST /auth/register` (sends OTP), then
   redirects to the new OTP page carrying the phone number. Register page
   DESIGN is untouched — only submit wiring changes.
2. A new public, locale-prefixed OTP page at `/{locale}/otp?phone=...` with a
   shadcn-style 6-box input (one digit per box), auto-advance/backspace/paste,
   auto-submit at 6 digits, resend with cooldown, and real
   `POST /auth/otp/verify` that logs the user in on success (same session
   cookies as `actions/login.ts`).

## Non-goals

- No backend changes of any kind.
- No change to register page layout, fields, or validation schema
  (`schemas/register.ts` stays as-is).
- No consumption of firstName/lastName/password by the backend (the backend
  phone-OTP flow does not accept them; they remain collected-but-unused, same
  as today).
- No i18n message keys (auth surface is hardcoded English today; translating it
  is a separate ticket covering all auth pages).
- No changes to the orphaned `components/auth/OtpForm.tsx` (left untouched).
- No new dependencies.

## Decisions

1. **Route: `/[locale]/(user)/(auth)/otp/page.tsx`** — lives beside
   login/register in the `(auth)` group (NavBar/Footer from the `(user)`
   layout, consistent with register). Register `"/otp": {}` in
   `i18n/routing.ts` `pathnames` (required for typed hrefs; matches how
   `/register` is registered at routing.ts:19). Public by default — proxy only
   guards `/wanderer/dashboard/**`.
2. **Phone transport: URL query param** `?phone=<E.164>` — stateless, survives
   refresh, matches the `useSearchParams()` convention
   (`category/[categorySlug]/page.tsx:21`). The register submit normalizes the
   phone once and passes the SAME normalized value to the OTP page, so register
   and verify keys always match. Missing/invalid phone on the OTP page →
   `router.replace("/register")`.
3. **Phone normalization: new helper `apps/web/lib/phone.ts`** —
   `normalizePhone(raw: string): string`: trim; strip everything except digits
   and a leading `+`; if it starts with `+` keep as-is; else drop a leading `0`
   and prefix `+855` (Cambodian local format, matches the zod `min(8).max(10)`
   local-number assumption); return `""` if the result has fewer than 8 digits.
   Shared by the register action and the OTP page so both produce identical
   E.164 values. The zod schema is NOT touched (design freeze).
4. **OTP input: reuse `@/components/ui/input-otp`** — `input-otp` is already
   installed (package.json:24), so this violates the no-dependency constraint
   none; it is the shadcn-style primitive and provides the required UX for
   free: one digit per box, auto-advance, backspace navigation, full-code
   paste, fake-caret. Render ONE `InputOTPGroup` with 6 `InputOTPSlot`s (no
   3+3 separator — single row of 6 boxes, simple and clean). Model the
   component on `components/auth/OtpForm.tsx` (Card + Field + FieldLabel) but
   with SMS copy instead of Telegram. Fallback (only if the captain later wants
   the dependency dropped): hand-rolled 6-ref `<input maxLength={1}
inputMode="numeric">` row implementing auto-advance, backspace-to-previous,
   paste-splitting, auto-submit — behavior contract is identical.
5. **Auto-submit**: `useEffect` fires verify when `value.length === 6` and not
   already verifying; the explicit Verify button remains (disabled +
   "Verifying…" while pending) as the accessible fallback.
6. **Resend: real `POST /auth/otp/request` + 60s client-side cooldown** — the
   endpoint exists precisely for this. Cooldown starts on page mount (the OTP
   was just sent by register) and restarts on each resend; button shows the
   remaining seconds, disabled during cooldown.
7. **Verify wiring: real API + auto-login** — new server action calls
   `POST /auth/otp/verify`; on success `setUserSession({accessToken,
refreshToken})` (mirrors `actions/login.ts:47`), then the client toasts
   success and `router.push("/")` (mirrors LoginForm.tsx:40-43). On failure:
   toast the backend `error.message` (fallback "Invalid or expired code"),
   clear the boxes, allow retry. Do NOT send `preferredLanguage` (backend
   allows only en/km/zh; web locales include ko/id/vi — sending it would 400).
8. **Register submit wiring (minimal diff)** — `actions/register.ts` gains the
   real `POST /auth/register` call (plain fetch + envelope unwrap, copying
   `actions/login.ts:22-43`); it keeps returning `{ success, error? }`.
   `RegisterForm.tsx` onSubmit changes only: normalize phone via
   `normalizePhone`, call `register({ phone: normalized })`, on success replace
   the JSON-dump toast with a plain "Code sent" toast and
   `router.push({ pathname: "/otp", query: { phone: normalized } })` using
   `useRouter` from `@/i18n/routing`. Keep `form.reset()`. No JSX/layout edits.
9. **i18n: no new keys** — all auth pages are hardcoded English today
   (RegisterForm, LoginForm, OtpForm); the OTP page follows suit for
   consistency. Translating the auth surface is a separate cross-page ticket.
10. **Styling: existing primitives only** — Card/CardHeader/CardContent/
    CardFooter, Field/FieldLabel/FieldDescription, Button, InputOTP from
    `@/components/ui/*`; `cn` from `@/lib/utils`; orange submit button
    (`bg-orange-500 hover:bg-orange-600 text-white h-10 w-full`) matching
    login/register; centered `max-w-md` card on the page.

## Implementation plan

1. **NEW `apps/web/lib/phone.ts`** — `normalizePhone(raw: string): string`
   per Decision 3. Pure function, no deps.
2. **NEW `apps/web/actions/otp.ts`** (`"use server"`) — copy the fetch pattern
   from `actions/login.ts`:
   - `requestOtp(phone: string): Promise<{ success: boolean; error?: string }>`
     → `POST ${API_URL}/auth/otp/request` body `{ phone }`.
   - `verifyOtp(phone: string, token: string): Promise<
    { success: true; user: { id: string; username: string | null; role: string } } |
    { success: false; error: string }>` → `POST ${API_URL}/auth/otp/verify`;
     on success call `setUserSession({ accessToken, refreshToken })`. Import
     `API_URL` from `@/lib/api/client`, `setUserSession` from
     `@/lib/auth/session`. Parse the envelope defensively
     (`res.json().catch(() => null)`), exactly like login.ts:28-43.
3. **MODIFY `apps/web/actions/register.ts`** — keep the zod safeParse gate;
   normalize the phone with `normalizePhone`; `POST ${API_URL}/auth/register`
   body `{ phone }`; return `{ success: false, error }` on !res.ok (map
   error.message), `{ success: true }` on `{ otpSent: true }`.
4. **NEW `apps/web/components/auth/OtpVerifyForm.tsx`** (`"use client"`) —
   props `{ phone: string }`. State: `value` (6-digit string), `verifying`
   (boolean), `cooldown` (number, starts 60), `resending` (boolean).
   `useEffect` countdown timer (1s interval, cleaned up). Verify handler
   shared by auto-submit effect and the button (guards: length 6, not already
   verifying). Resend handler: `requestOtp(phone)`, restart cooldown, toast.
   Structure modeled on `components/auth/OtpForm.tsx` (Card, Field,
   FieldLabel, back-arrow Button linking to `/register` via `Link` from
   `@/i18n/routing`): title "Verify your phone", description "We sent a
   6-digit code via SMS to {phone}. Enter the code to finish creating your
   account.", one `InputOTPGroup` of 6 slots (h-12 w-12 boxes), Resend button
   beside the label, full-width orange Verify button, muted "Wrong number? Go
   back to register" link. No `any` (strict lint).
5. **NEW `apps/web/app/[locale]/(user)/(auth)/otp/page.tsx`** — server
   component; `metadata` title "Verify your phone"; renders a centered wrapper
   (`container mx-auto my-6 px-4` — register sits inside NavBar/Footer, so a
   lighter wrapper matches RegisterForm) around a small client shim
   `OtpPageClient` that reads `useSearchParams().get("phone")`, normalizes +
   validates it (`normalizePhone`, length ≥ 8), and renders `OtpVerifyForm` —
   or `router.replace("/register")` when absent/invalid. (SearchParams access
   must be client-side per the existing convention; wrap the shim in
   `<Suspense>` if Next requires it for `useSearchParams` during static
   prerender.)
6. **MODIFY `apps/web/components/auth/RegisterForm.tsx`** — only the
   `onSubmit` body: add `useRouter` from `@/i18n/routing`; normalize phone;
   call the updated `register({ phone: normalized })`; on success
   `toast.success("Code sent to your phone.")` + `router.push({ pathname:
"/otp", query: { phone: normalized } })`; on failure
   `toast.error(result.error ?? "Failed to send code.")`. Remove the
   JSON.stringify toast description. Zero JSX changes.
7. **MODIFY `apps/web/i18n/routing.ts`** — add `"/otp": {}` to `pathnames`
   beside `/register` (line 19).

## Edge cases the implementation must handle

- Phone missing, empty, or non-normalizable on `/otp` → redirect to
  `/register` (no crash, no dead UI).
- Phone containing `+` in the URL — always `encodeURIComponent` when building
  the link; `useSearchParams` decodes automatically.
- Verify 401/400 (wrong or expired code) → toast backend message, clear input,
  allow retry; never leave `verifying` stuck (finally-block reset).
- Network failure / backend down → toast "Failed to verify. Please try again.";
  input preserved for retry.
- Double-submit: Verify button disabled while `verifying`; auto-submit effect
  must not re-fire while verifying or after success navigation.
- Resend during cooldown impossible (button disabled + countdown label);
  resend failure shows toast but does NOT restart cooldown.
- Pasting fewer/more than 6 digits: input-otp truncates to 6 — no manual
  handling needed; non-digit input is filtered by the component.
- Leading-zero local numbers (`0123456789`) and spaced input
  (`012 345 678`) both normalize to `+855…`-style E.164 before any API call.
- Dev flow: backend must run with `DEV_OTP_TOKEN` set; then any phone works
  and the fixed token verifies (document in the report, not in UI copy).

## Verification plan

- `pnpm --filter web lint` — clean.
- `pnpm --filter web build` — clean (this is the web type gate; catches the
  typed-href requirement for `/otp`).
- Manual (dev, backend with `DEV_OTP_TOKEN` set): register → OTP page → wrong
  code error → dev token auto-login → `/` with `user_access_token` cookie;
  resend cooldown; no-`?phone` redirect; `/km/otp` locale route works.
- Backend untouched: `git status` shows no `apps/backend/**` changes.

## Open questions

None blocking. One flag for the captain: the "hand-roll, no input-otp"
constraint was premised on the package being absent — it is already installed
(package.json:24) with a shadcn primitive in the tree, so the spec reuses it
(zero dependency change). If the dependency should still be avoided, the coder
falls back to the hand-rolled 6-box input with the identical behavior contract
(Decision 4).

---

## Revision R1 (2026-08-18): Cambodia-local phone input (captain-approved plan)

Decision change: the register input accepts ONLY local `0XXXXXXXXX`
(leading 0 mandatory; `^0\d{7,9}$`). `+855…` and no-leading-0 input are
invalid ("Invalid phone number."). Option A locked: wire/DB stay E.164 —
the system "makes up" the Cambodian number via the existing
`normalizePhone`. OTP page displays the local form (`formatPhoneLocal`).
Full approved plan: `~/.claude/plans/dynamic-kindling-platypus.md`.

---

## Revision R2 (2026-08-18): phone+password→OTP login; password/names/username at registration (approved plan rev 2)

Captain decisions: phone input is local `0XXXXXXXXX` only, no exception
frontend-wide; login form is correct as-is — phone + password always both
required, OTP comes AFTER backend password validation; registration must
set a password; usernames auto-generated unique at insert (names-based);
login-mode rejects unknown phones. Backend extended: VerifyOtpDto gains
required `password` + optional names (insert-only extras; conflict path
never overwrites), new `POST /auth/otp/login` (password-gated OTP send),
`RequestOtpDto` hygiene rider. Web: sessionStorage handoff for
password/names (never URL), login submit branch for phone identifiers,
OTP page mount-guard + mode-aware back navigation. Full approved plan:
`~/.claude/plans/dynamic-kindling-platypus.md`.

---

## Revision R4 (2026-08-19): user account mode — Phase A (identity)

Captain: "after login … we can use as user account … right now it like visitor
mode." Phase A approved: web reads the USER session and renders identity.
- `userServerFetch` (user-side twin of the admin client, transparent
  refresh on 401, ApiError on failure).
- `getCurrentUser()` fail-soft server helper (anonymous fast-path: no
  tokens → null, zero backend calls).
- `(user)/layout.tsx` session-aware → NavBar real identity; SocialBar real
  avatar/name/username + real logout (`userLogout`); `/me` real account
  card. Guest navbar unchanged. Phase B (post-an-ad) deferred by captain.
