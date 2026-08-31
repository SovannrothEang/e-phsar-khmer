# Test results — OTP verification page (web)

Date: 2026-08-17 · Branch: `feat/otp-verification-screen` · Base: `c9afe97`
(mock-wired OTP from an interrupted earlier run of this same ship) with this
pass's spec-compliant changes in the working tree on top.

## Gates

| Gate              | Command                   | Result                                                                                                                                                          |
| ----------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint              | `pnpm --filter web lint`  | **PASS** — 0 errors, 1 warning                                                                                                                                  |
| Build (type gate) | `pnpm --filter web build` | **PASS** — full compile + type-check; `/[locale]/otp` listed as dynamic route                                                                                   |
| Backend tests     | not run                   | **N/A — backend untouched** (`git diff HEAD -- apps/backend` = 0 files). Web-only change; backend suite (149 tests, green in previous ship) cannot be affected. |
| Web unit tests    | not run                   | N/A — `apps/web` has no test script; `next build` is the repo's type gate per CLAUDE.md.                                                                        |

### Lint detail

- 1 pre-existing warning: `components/auth/AdminLoginForm.tsx:12` unused
  `FieldDescription` — file untouched by this ship; same warning was recorded
  in the previous ship's test results.

### Build detail

- `✓` full route generation; `— /[locale]/otp` present (dynamic, due to
  `useSearchParams` in the client shim behind `<Suspense>`).
- Typed-route check passed: `router.push({ pathname: "/otp", … })` compiles,
  proving the `pathnames` registration is correct.

## Manual verification NOT executed (documented gap)

The spec's manual flows were **not** run against a live backend (no dev
backend session with `DEV_OTP_TOKEN` was started). Unverified behaviors:

1. Register submit → real OTP SMS/request reaches backend and page redirects
   with normalized `+855…` phone.
2. Wrong-code error path (toast + clear + retry) against real 400/401
   responses.
3. Correct code (dev token) → cookies set + redirect to `/`.
4. Resend cooldown against real `/auth/otp/request`.
5. `/otp` with no `?phone` → redirect to `/register`.
6. Locale-prefixed routes (`/km/otp?phone=…`) render.

All six are covered by code paths the type gate exercised structurally but
not at runtime. Recommend a 10-minute morning manual pass with the backend
running under `DEV_OTP_TOKEN`.

## Working-tree scope audit (post-gates)

- Backend: 0 changed files.
- `apps/web/i18n/routing.ts`: net-zero diff vs HEAD (identical `/otp` entry
  already committed by `c9afe97`).
- Register page design: no JSX changes — submit handler wiring only
  (verified in review stage).

## R1 gates (2026-08-18)

- `pnpm --filter web lint` — PASS (0 errors; 1 pre-existing warning in
  untouched `AdminLoginForm.tsx`).
- `pnpm --filter web build` — PASS (compiled successfully;
  `/[locale]/otp` present).
- Manual matrix NOT executed (no dev servers running). Plan-file matrix
  stands for the morning pass — key rows: `012345678` passes; `12345678`,
  `+85512345678`, `0123456`, `012345678a` → "Invalid phone number.";
  wire/DB stays `+855…`; OTP page displays `012345678`.

## R2 gates (2026-08-18)

- `pnpm --filter backend test` — **PASS 159/159** (149 pre-existing + 10
  new: insert extras, conflict-set purity, wrong-password 401 without
  Supabase call, legacy-no-password 401, requestLoginOtp trio, DTO
  missing/short password).
- `pnpm --filter backend build` — PASS. `pnpm --filter backend lint` —
  PASS (0 problems).
- `pnpm --filter web lint` — PASS (0 errors; same 1 pre-existing warning
  in untouched `AdminLoginForm.tsx`). `pnpm --filter web build` — PASS
  (✓ compiled, `/[locale]/otp` present).

## R2 LIVE smoke test (backend from dist, DEV_OTP_TOKEN=000000)

1. verify `{phone, token}` without password → **400** (bypass closed).
2. `otp/login` unknown phone → **401**, no implicit registration.
3. Register verify (new phone + names + password) → success,
   `username=sokdara`, names stored.
4. Same names, second phone → `username=sokdara2`.
5. `otp/login` correct password → `{otpSent:true}`.
6. `otp/login` wrong password → **401** (no SMS).
7. Verify existing phone + wrong password → **401**.
8. Verify existing phone + correct password + crafted replay names
   ("Hacker") → success, `firstName=Sok` — **replay ignored**.
9. `otp/request` resend → 200; bad phone → **400** (DTO active).
10. DB rows: `+855990000001→sokdara`, `+855990000002→sokdara2`, both
    `password_hash` bcrypt `$2b$10$…`, names stored. (Two dev-DB test
    users created by this smoke run.)

NOT manually verified: the browser-side flows (login form submit branch,
sessionStorage handoff, OTP page mount-guard/back-target) — type/lint
gates only; morning browser pass recommended.

## R3 hotfix gates (2026-08-18)

- backend test/build/lint: PASS (159/159; the "legacy → 401" test replaced
  by "legacy bare user completed in place — password set, username
  generated, insert never called").
- LIVE (captain's watch backend, DEV_OTP_TOKEN=000000): bare
  `+855777000123` verify → success, username `smoketest`; otp/login with
  new password → otpSent; wrong password → 401; DB row has bcrypt hash.
