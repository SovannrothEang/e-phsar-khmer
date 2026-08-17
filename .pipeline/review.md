# Review — OTP verification screen (feat/otp-verification-screen)

## Verdict: APPROVE WITH NOTES — implementation matches spec and captain's constraints exactly (4/4-line behavior-only register diff verified, 6×1-digit shadcn card, honest mock); notes are non-blocking mock-stage tradeoffs already tracked as follow-ups.

## Evidence examined (files/diffs/claims verified)

- `.pipeline/spec.md`, `changes.md`, `test-results.md` — read in full; cross-checked against code below.
- `git diff` working-tree vs HEAD — scope is exactly the 4 claimed web files (+ pipeline docs; the `pnpm-lock.yaml`/`pnpm-workspace.yaml` deletions are pre-existing on-branch, correctly called out in G0).
- `apps/web/components/auth/RegisterForm.tsx` — numstat **4 insertions / 4 deletions** confirmed; hunks at `@@ -328`, `@@ -332`, `@@ -367` — all in live code (≥ 315); dead commented block (lines 1–314) untouched; **file still CRLF** (`file` reports CRLF terminators; diff lines carry `\r`). Diff content: import + `useRouter()` + success-branch toast/push only — **zero JSX/class changes, register design unchanged**. Bonus: removes the old toast that printed the password via `JSON.stringify(registerData)`.
- `apps/web/i18n/routing.ts` — exactly one added line `"/otp": {},` after `"/register"`.
- `apps/web/components/auth/OtpVerifyForm.tsx` (new) — matches spec plan point-by-point: `{ phone }` prop, single `InputOTPGroup` of 6 slots (no 3+3 separator, unlike the `OtpForm.tsx` template — spec decision 6 correctly applied), slot classes `h-12 w-12 text-xl`, demo code `123456` with visible hint, `<6` digits / wrong-code error toasts, empty-phone fallback card, resend mock toast (exact `OtpForm.tsx:89` pattern), back arrow + "Wrong number?" link to `/register`, success → `router.push("/login")`, plain `<form onSubmit>`.
- `apps/web/app/[locale]/(user)/(auth)/otp/page.tsx` (new) — matches the spec's code block verbatim (server component, `await searchParams` Next-16 convention, `phone ?? ""`).
- `apps/web/components/auth/OtpForm.tsx` — untouched (absent from `git status`), per spec decision 5.
- `apps/web/components/auth/LoginForm.tsx` — confirms the claimed `useRouter`/`Link` from `@/i18n/routing` idiom.
- `apps/web/schemas/register.ts` — `phoneNumber` is a required validated field (`min(8).max(10)`), so `query: { phone: value.phoneNumber }` is always populated on the success path.
- `apps/web/proxy.ts` — `/otp` is locale-prefixed user surface → routed through next-intl middleware; no guard interferes.
- G4 static assertions independently re-run (numstat, hunk positions, `"/otp": {}` count, OtpForm diff empty) — all reproduce.

## Findings

1. **[note] Spec deviation (typed-route push) is correctly handled and documented.** The spec's template-literal ``router.push(`/otp?phone=…`)`` fails next-intl's typed `Href`; the shipped object form `router.push({ pathname: "/otp", query: { phone: value.phoneNumber } })` is the documented next-intl 4.x API. Documented in `changes.md`, root-caused with verbatim error in `test-results.md` G1, fix re-run green. Deviation is an improvement, not a dodge.
2. **[note] Phone number is carried in the URL query param and displayed unmasked.** Acceptable for a mock (survives refresh, debuggable — the spec's stated rationale), but phone numbers in URLs persist in browser history. When wiring the real flow, prefer masking the display (e.g. `•••• 123`) and passing the phone server-side or in POST body.
3. **[note] `(Demo code: 123456)` is visible in production UI.** Intentional per spec decision 2 and honest about the mock; must be stripped when real verification lands. Also note the code itself (`value === "123456"`) is client-side — trivially bypassable; fine for mock, meaningless as security.
4. **[note] "Login by phone" phrasing vs implemented flow.** The captain's step-by-step description ("user will register, with phone number on register, and after user click submit … redirect to otp screen") unambiguously describes the register→OTP flow, which is what shipped. There is **no OTP path at login** for existing users (`LoginForm` is username/password → `/`). The backend (`POST /auth/register` + `POST /auth/otp/verify`) supports both; if the captain also wants OTP at login time, that is a separate follow-up, not a gap in this spec.
5. **[note] Back-arrow `Button` has no `aria-label`.** Copied from `OtpForm.tsx` (same omission), so consistent with sibling code; icon-only button is unnamed for screen readers. Fix opportunistically with the dead-code cleanup.
6. **[note] Resend is a pure mock toast — no cooldown, no new code.** Spec decision 7, honest for mockup; follow-up already tracked.
7. **[note] No browser-level verification exists** (repo has no e2e harness). G1's route manifest proves `/[locale]/otp` registered; the interactive behaviors (toast → redirect, per-locale render) are untested-but-type-checked. Consistent with repo norms; the "Not covered" list in `test-results.md` is accurate and appropriately scoped.

No blockers. Register design constraint honored (verified at diff level, not just claimed); no scope creep (dead code left alone, `OtpForm.tsx` untouched, no locale/backend edits); the four pipeline artifacts are mutually consistent — no claim in `changes.md`/`test-results.md` is contradicted by the code.

## Follow-up tickets (ready-to-file one-liners with suggested scope)

- **Real OTP wiring (web+backend):** collapse register form to phone-first or extend `POST /api/v1/auth/register` to accept name/password, then call `POST /api/v1/auth/otp/verify` from `/otp`; remove demo code + hint from `OtpVerifyForm.tsx`. (Spec "Out of scope" #1.)
- **User-surface session plumbing:** `setUserSession` + `userServerFetch` so a real verify lands the user in an authenticated state instead of routing to `/login`. (Spec "Out of scope" #2.)
- **Login-time phone OTP:** if the captain wants OTP for existing users at login (the "after normal user login by phone number" reading), add an OTP step to the login flow — backend already supports it.
- **Resend cooldown/countdown + real SMS/Telegram copy** once a provider is wired. (Spec "Out of scope" #3.)
- **Dead-code cleanup:** delete unused `InputOTPForm` in `OtpForm.tsx` and the commented block in `RegisterForm.tsx` lines 1–314; add `aria-label` to icon-only back buttons while there. (Spec "Out of scope" #4.)
- **Phone display masking + non-URL hand-off** when real PII is involved (finding 2).

## Answers to the captain's questions (concise recap)

- **Did we have an OTP screen after login/register by phone?** No — nothing existed on the user surface before this change; `OtpForm.tsx` was unused dead code with Telegram/email copy and parent-driven props.
- **Did we have a page for it?** No — no `/otp` route existed. Now created: `app/[locale]/(user)/(auth)/otp/page.tsx` + locale-aware `"/otp"` in `i18n/routing.ts`.
- **Was the existing form enough, even as mockup?** As a template yes, as the screen no — it had no route, no phone display, wrong copy, and expected a parent to own verification/navigation. The new `OtpVerifyForm` keeps its proven 6-slot UI (single group, one digit per box, shadcn card, orange Verify button) and is fully self-contained: demo code `123456`, success → `/login`, resend mocked, empty-phone fallback. Sufficient for mockup; real wiring needs the backend-contract follow-up above.
- **Register design:** unchanged — verified 4-ins/4-del behavior-only diff (toast text + redirect); no JSX or styling touched.
