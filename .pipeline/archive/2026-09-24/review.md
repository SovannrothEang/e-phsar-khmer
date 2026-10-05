# Review

## Verdict

**APPROVE WITH NOTES** — Spec-faithful, race-safe implementation with a clean
register design freeze; only note-level hardening items and one outstanding
manual-verification pass remain.

## Evidence

**Pipeline docs read**

- `.pipeline/spec.md` (Decisions 1-10, edge cases, verification plan)
- `.pipeline/changes.md` (documents the one deviation: normalization in the
  action, not the form)
- `.pipeline/test-results.md` (lint/build PASS; manual flows honestly marked
  NOT executed)

**Working tree inspected (read-only)**

- `apps/web/lib/phone.ts` — traced `normalizePhone` against every weird input:
  `""`→`""`; `"+"`→`""` (digits empty); `"0"`→`""` (3 digits < 8);
  `"0000000000"`→`+855000000000` (12 digits, passes); `"012 345 678"`→
  `+85512345678`; `"+85512345678"`→passthrough; `"abcdefgh"`→`""`→action
  returns "Invalid phone number". Algorithm matches spec Decision 3 exactly
  (single leading `0` strip).
- `apps/web/actions/otp.ts` — envelope parsing is a faithful copy of the
  `login.ts` pattern (`res.json().catch(() => null)`, `!res.ok ||
!body?.success`), plus a stricter `!body.data` guard; `setUserSession`
  awaited before returning success (legal cookie write from a server action,
  same as login.ts:47).
- `apps/web/actions/register.ts` — zod gate kept, normalize before fetch,
  `{ phone }` body only. Sends no `preferredLanguage` — correct, since
  `RegisterDto` is `@IsIn(['en','km','zh'])` while web locales include
  ko/id/vi (spec Decision 7 honored).
- `apps/web/components/auth/OtpVerifyForm.tsx` — race analysis: `inFlightRef`
  set synchronously before the await (single-threaded, so button/Enter/
  auto-submit double-fire is impossible), `doneRef` blocks re-fire after
  success navigation, `finally` resets both `inFlightRef` and `verifying`
  (never stuck). Cooldown timer is a per-tick `setTimeout` with cleanup — no
  interval leak; resend failure only toasts, does not restart cooldown (spec
  edge case honored). Failure path clears input; catch path preserves it
  (spec distinction honored).
- `apps/web/components/auth/OtpPageClient.tsx` +
  `apps/web/app/[locale]/(user)/(auth)/otp/page.tsx` — client-side
  `useSearchParams` (matches `category/[categorySlug]/page.tsx:21`
  convention), `<Suspense>` wrapper, redirect-then-null on bad phone; build
  listed `/[locale]/otp` as dynamic, consistent.
- **Register design freeze verified**: whitespace-insensitive diff of
  `git show HEAD:apps/web/components/auth/RegisterForm.tsx` vs working tree
  shows the only semantic deltas are the `useRouter` import, the onSubmit body
  (dead `name`/`username` construction from HEAD removed, new `register(value)`
  wiring, `router.push({ pathname: "/otp", query: { phone: res.phone } })`),
  and the toast copy. The JSX tree (container divs, FieldGroup, five
  AppFields, both Buttons with identical className strings) and the
  commented-out legacy block (lines 1-315) are unchanged — the 841-line diff
  is genuinely the formatter, exactly as changes.md claims.
- `apps/web/i18n/routing.ts:20` — `"/otp": {}` present; `git diff HEAD` on
  the file is empty (net-zero confirmed).
- **Backend contract**: `register.dto.ts:6` and `verify-otp.dto.ts:6` both
  enforce `^\+?[1-9]\d{6,14}$`; `verify-otp.dto.ts:13` `@Length(4, 8)` on
  token — 6-digit InputOTP output fits. `auth.controller.ts:33` confirms
  `POST /auth/otp/request` exists. `idempotency.middleware.ts:35-38`
  confirms POSTs without an `Idempotency-Key` header pass through — so
  omitting the header (like `login.ts`) is consistent, not a bug.
- **Hygiene**: grep of all five new/rewritten files found zero `any`-types
  and zero secrets/env reads. `Button` `size="xs"` exists (`button.tsx:26`).
  The `(user)` layout wraps the OTP page in NavBar/Footer as spec Decision 1
  asserts. Old `OtpForm.tsx` untouched (absent from git status).
  `git diff HEAD -- apps/backend` = 0 files.

## Findings

1. **note — Garbage-tolerant phone normalization.** `apps/web/lib/phone.ts:18-22`:
   `"0000000000"` normalizes to `+855000000000`, which _passes_ the backend
   regex (OTP dispatched to a nonexistent number), and `"+0123456"` passes
   the helper but is rejected by the backend's `[1-9]` anchor (surfaces as an
   error toast — acceptable). Inherent to the spec's own Decision 3 algorithm
   plus the frozen `min(8).max(10)` zod schema (`schemas/register.ts:6`,
   untouched per non-goal). No security impact; tighten in a later pass if
   SMS costs matter.
2. **note — Hand-edited raw `+` in the URL double-prefixes.** A manually typed
   `?phone=+855…` (unencoded `+`) is decoded as a leading space by
   `useSearchParams`; `normalizePhone` trims it, sees no `+`, and produces
   `+855855…` (wrong number). App-generated links always encode via the
   router query object, so only hand-mangled URLs hit this. Hardening option:
   treat digits already starting with `855` after local-strip, or compare
   against the register-step value — file under follow-up, not blocking.
3. **note — Register network failure has no user-visible toast.**
   `RegisterForm.tsx:345-355` does not try/catch `register(value)`; if the
   backend is unreachable the server action rejects and TanStack Form
   swallows it into form error state (no crash, but no toast). `OtpVerifyForm`
   got the defensive catch because the spec's edge-case list required it
   there. Identical to the existing `login.ts`/`LoginForm` behavior —
   consistent, optional hardening.
4. **note — `required` on the visually-hidden OTP input.**
   `OtpVerifyForm.tsx:154` passes `required` to `InputOTP`; if a form submit
   ever fires with < 6 digits, native validation on the collapsed input can
   produce a "not focusable" console warning instead of the old toast.
   Practically unreachable (submit button disabled at `value.length !== 6`),
   informational only.
5. **note — Pipeline docs omit the pre-existing working-tree deletions.**
   `apps/web/pnpm-lock.yaml` and `apps/web/pnpm-workspace.yaml` are
   deleted-but-uncommitted in the working tree (intentional from the earlier
   standalone-deps session, not this ship). Neither changes.md nor
   test-results.md mentions them, and changes.md's "git status confirms"
   framing could lead a committer to sweep them into this ship's commit with
   `git add -A`. Call them out or commit them separately.
6. **note — Spec deviation is an improvement.** Normalization living in
   `actions/register.ts:21` with the E.164 value returned to the form
   (`res.phone`) guarantees the register key and the verify key are
   byte-identical by construction — strictly safer than the form normalizing
   and the action re-normalizing independently. Deviation is documented in
   changes.md. Accepted.

## Follow-up tickets

1. **Manual OTP flow verification** (spec's verification plan, 6 flows listed
   in `test-results.md`): run the 10-minute pass with backend under
   `DEV_OTP_TOKEN` — register→OTP page with `+855…` param, wrong-code
   toast+clear+retry, dev-token auto-login + `user_access_token` cookie + `/`
   redirect, resend cooldown, no-`?phone` redirect, `/km/otp` locale route.
   None were executed at runtime.
2. **Phone validation hardening** — `apps/web/lib/phone.ts`: reject all-zero
   digit runs and consider handling an `855`-prefixed local body; also decide
   policy for hand-edited raw-`+` URLs (finding 2). Small, self-contained,
   testable.
3. **Failure-toast parity for register** — wrap the `register(value)` call in
   `RegisterForm.tsx` onSubmit with a catch → `toast.error("Failed to send
code. Please try again.")`, mirroring `OtpVerifyForm.tsx:64-66`. Apply the
   same to `actions/login.ts`/`LoginForm.tsx` in one sweep if touching it.
4. **Commit hygiene** — land the `apps/web/pnpm-lock.yaml` /
   `apps/web/pnpm-workspace.yaml` deletions (or restore them) in a separate
   commit so this ship's diff stays web-auth-scoped (finding 5).

## R1 addendum (2026-08-18)

Follow-up patch (Cambodia-local phone input) executed under a
captain-approved plan (plan mode): exploration + independent design check
both returned SOUND (zod 4.4.3 `.trim().regex` chaining verified;
blur-gated error display verified in form-core 1.33.2; `^0\d{7,9}$`
checked against the `utils/telecom.ts` prefix map; empty ripple surface —
`registerSchema` consumed only by RegisterForm + actions/register, no web
tests exist). Gates green. Full agent review not re-run for this ~10-line
patch; captain's morning review is the gate. New follow-ups: telecom.ts
Seatel prefix duplication; i18n pass for schema messages; optional vitest
spec for phone helpers; optional `inputMode` via FormControlProps.

## R2 addendum (2026-08-18)

Executed under captain-approved plan rev 2 (plan mode; two exploration
passes + design check). Gates green (backend 159/159 tests, lint, build;
web lint, build). LIVE smoke test verified the full backend contract
including the two security invariants: verify requires a password (400
without), and the conflict path ignores crafted replay payloads. The
browser-side flows (LoginForm branch, sessionStorage handoff, OTP-page
guards) are gate-verified but not browser-tested — flagged for the
morning pass. API contract change: `/auth/otp/verify` now REQUIRES
`password` — backend+web must deploy together (forbidNonWhitelisted).
New follow-ups: 23505 retry in generateUniqueUsername consumers;
UpdateProfileDto name length caps; phoneVerifiedAt never written;
public otp/request SMS-abuse surface.

## Post-review follow-up resolved (2026-08-25): /me design restoration + real identity

Captain's morning-review catch: R4's /me change had replaced the designed
Manage Ads page with a minimal account card ("why the /me change the
'manage ads'?" — expected the tabbed design with Total Ads 0/5, Renews
0/5, Active/Expired, No Result!/Sell your stuff per reference image).
Resolved with an approved plan (plan mode): restored `page.tsx` →
`<ManageAds />`; `me/layout.tsx` now gates on `getCurrentUser()` (redirect
to `/[locale]/login`) and feeds the real session into `MyProfileHeader`
via a narrowed `ProfileUser` prop (name/@username/avatar/cover/joined
date; following/follower + Resume button stay mock — no backend data yet,
Phase C). `SessionUser` gained `coverPhotoUrl`. The R4 account card is
removed.

Also fixed while E2E-testing: `userLogout()` redirected to bare `/login`,
which 404s under `/ [locale]/` routing — now locale-aware
(`getLocale()` + i18n `redirect`). THIS was introduced by R4 and never
browser-tested until now.

Verification: web lint 0 errors (1 pre-existing AdminLoginForm warning);
web build PASS; full browser E2E 20/20 (fresh chromium, DEV_OTP_TOKEN,
register → OTP → /me → design + identity markers → refresh → dropdown
Sign out → /en/login → visitor chrome). E2E how-to notes recorded in
tasks/todo.md (avatar trigger class `.ml-2`; Radix pointerdown for
triggers, click for items; "Sell your stuff" (captain-confirmed text)).
No new follow-ups; remaining work: Phase B (post-an-ad), Phase C
(subpages/feed), following/follower backend.
