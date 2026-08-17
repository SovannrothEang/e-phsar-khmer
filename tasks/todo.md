# Ship: phone-OTP verification screen after user registration

Feature request (verbatim): "after normal user login by phone number, we need to set otp to
confirm with phone number. 1. do we have otp screen yet after login by phone number? (user will
register, with phone number on register, and after user click submit after fill information), we
should redirect to otp screen right? and if we have to do so, then does we have page for otp? if
not, then you need to create a otp component and page to handle this, and about page you need to
get the design of shadcn style which is simple and clean, and otp 1 column accpet only one digit,
and otp need 6 digit for this. NOTE: don't change register design, it will serve. by the way,
does otp form can give us enough yet? even if it mock up?"

## Ground truth gathered (setup)

- `components/auth/OtpForm.tsx` already exists; only app-side OTP usage is inside
  `forgot-password/page.tsx` — no dedicated OTP page/route.
- `components/ui/input-otp.tsx` (shadcn) exists and `input-otp@^1.4.2` is already a dependency
  → using it adds no new dependency.
- Register surface: `app/[locale]/(user)/(auth)/` group; register action is a mock
  (`actions/register.ts` returns success, no backend call).
- Backend already has the OTP endpoints: `POST /api/v1/auth/register {phone}` (sends OTP) and
  `POST /api/v1/auth/otp/verify {phone, token}` (creates user, returns tokens).
- User-surface server fetch may not exist yet (`serverFetch` reads admin cookies only).

## Plan

- [x] Stage 1 — Planner: verify OTP-page status + register submit path; produce `.pipeline/spec.md` (no open questions — mock-wired /otp page + demo code 123456; dead `OtpForm.tsx` left as template)
- [x] Stage 2 — Coder: implement OTP component/page + register redirect hook; produce `.pipeline/changes.md` (2 new files, 2 edited; anchors verified by orchestrator before applying)
- [x] Stage 3 — Tester: run web build/lint (+backend gates if touched); produce `.pipeline/test-results.md` (all gates PASS — build needed one must-fix: next-intl typed Href rejects template-literal query strings; tester had predicted the exact failure)
- [x] Stage 4 — Reviewer: review full pipeline output; produce `.pipeline/review.md` (APPROVE WITH NOTES, no blockers)
- [x] Commit feature files on `feat/otp-verification-screen` (NOT the pre-existing
      `apps/web/pnpm-lock.yaml` / `pnpm-workspace.yaml` deletions); leave branch unmerged for review

## Constraints

- No new dependencies; no API contract changes; minimal diff.
- Do NOT change the register page design — only add the redirect-to-OTP behavior.
- shadcn style, simple + clean; 6 boxes, one digit per box.
- Mockup wiring is explicitly acceptable (captain's note); real backend wiring = follow-up.
- Subagents are read-only in this environment — main thread performs all writes + gate runs.

## Review

Verdict: **APPROVE WITH NOTES** (no blockers) — see `.pipeline/review.md`.

- What shipped: `/[locale]/otp` verification page (shadcn card, 6 single-digit slots, demo code
  `123456`, success → `/login`, resend mocked, empty-phone fallback) + register success now
  toasts (no more password dump) and redirects to `/otp?phone=…`. Register design untouched —
  verified 4-ins/4-del behavior-only diff, dead block + `OtpForm.tsx` untouched, CRLF preserved.
- Gates: web build PASS (after one must-fix: next-intl typed `Href` rejects template-literal
  query strings → `{ pathname, query }` object form; tester predicted the exact failure),
  web lint PASS (1 pre-existing warning in untouched `AdminLoginForm.tsx`),
  backend 149/149 PASS, static scope/assertion checks 6/6.
- Not covered: no browser/e2e harness — interactive flow (toast, redirect, per-locale render)
  is type-checked but not click-tested.
- Follow-ups filed in review.md: real OTP wiring (backend register takes only `{phone}`),
  user-session plumbing, login-time phone OTP, resend cooldown, dead-code cleanup,
  phone masking.
