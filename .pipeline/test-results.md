# Test results — OTP verification screen (feat/otp-verification-screen)

Run date: 2026-08-17 Runner: orchestrator (main thread; tester subagent designed the gates — subagents are read-only in this environment)
Commit: 4d6e91a (changes uncommitted in working tree at test time)

| #   | Gate                  | Command                                              | Exit          | Verdict               |
| --- | --------------------- | ---------------------------------------------------- | ------------- | --------------------- |
| G0  | Change scope          | `git status --porcelain` + working-tree diff vs HEAD | 0             | PASS                  |
| G1  | Web build (type gate) | `pnpm --filter web build`                            | 1 → fixed → 0 | PASS (after must-fix) |
| G2  | Web lint              | `pnpm --filter web lint`                             | 0             | PASS                  |
| G3  | Backend unit tests    | `pnpm --filter backend test`                         | 0             | PASS (149/149)        |
| G4  | Static assertions     | grep/git checks below                                | 0             | PASS (all 6)          |

## Summary verdict: PASS

(G1 failed on first run with exactly the failure the tester predicted from reading next-intl's shipped types; the fix — also the tester's suggested one — was applied and the gate re-run green. Story below.)

## G0 — Change scope

This-feature diff (working tree vs HEAD) touches exactly the 4 claimed files, all under `apps/web/`:

- `apps/web/components/auth/RegisterForm.tsx` (M)
- `apps/web/i18n/routing.ts` (M)
- `apps/web/app/[locale]/(user)/(auth)/otp/` (new, untracked)
- `apps/web/components/auth/OtpVerifyForm.tsx` (new, untracked)

Plus docs: `.pipeline/spec.md`, `.pipeline/changes.md`, `tasks/todo.md` (pipeline artifacts, repo-tracked). Nothing in `apps/web/messages/`, nothing in `apps/backend/`, nothing in `packages/`. Pre-existing on-branch, NOT from this change: deletions of `apps/web/pnpm-lock.yaml` / `apps/web/pnpm-workspace.yaml`, `.pipeline/review.md` / `.pipeline/test-results.md` deletions (user archived prior ship to `.pipeline/archive/2026-08-16/`, untracked). The delta vs `main` additionally contains the previous ship's committed fix (`4d6e91a`: backend `seed.ts`, `actions/category.ts`, `actions/subcaetgory.ts`) — expected, this branch is stacked on that unmerged fix.

## G1 — pnpm --filter web build

First run — Exit status: 1. Error verbatim:

```
./components/auth/RegisterForm.tsx:370:21
Type error: Argument of type '`/otp?phone=${string}`' is not assignable to parameter of type
'"/" | "/login" | "/register" | "/otp" | ... | ({ ...; } & { ...; })'.
```

This is EXACTLY the tester's prediction (finding #1): with `pathnames` configured, next-intl's typed `Href` only accepts the exact literal string or the object form `{ pathname, query }`. Runtime would have worked; it is purely type-level.

Fix applied (typed object form — the tester's suggested fix, matching next-intl 4.13.2 types):

```ts
router.push({ pathname: "/otp", query: { phone: value.phoneNumber } });
```

Re-run — Exit status: 0. Compiled successfully, full route table emitted; route manifest proves the new route registered:

```
"/[locale]/otp"
"/[locale]/(user)/(auth)/otp/page"
```

Verdict: PASS (must-fix applied and verified; no other errors in either new file).

## G1-diagnostic — not needed (failure was singular, identified, fixed; tsc companion skipped)

## G2 — pnpm --filter web lint

Exit status: 0. Output:

```
components/auth/AdminLoginForm.tsx
  12:3  warning  'FieldDescription' is defined but never used  @typescript-eslint/no-unused-vars
✖ 1 problem (0 errors, 1 warning)
```

Verdict: PASS. The single warning is pre-existing (same warning present on the base branch; file untouched by this change). Zero errors/warnings in the 4 changed files.

## G3 — pnpm --filter backend test

Exit status: 0.

```
Test Suites: 16 passed, 16 total
Tests:       149 passed, 149 total
```

Verdict: PASS. Backend untouched (G0); regression baseline 149/149 held.

## G4 — Static assertions

- `grep -c '"/otp": {}' apps/web/i18n/routing.ts` → **1** ✅
- `git diff -- apps/web/components/auth/OtpForm.tsx | wc -l` → **0** ✅ (spec decision 5: template file untouched)
- `git diff --name-only -- apps/web/messages apps/backend` → **empty** ✅ (no locale-file or backend edits)
- `git diff --numstat -- apps/web/components/auth/RegisterForm.tsx` → **4 4** ✅; hunk headers `@@ -326,10` and `@@ -364,10` — both ≥ 315, dead commented block (lines 1–314) untouched ✅
- `grep -n '123456\|No phone number to verify' OtpVerifyForm.tsx` → hits at lines 39 (demo code check), 55 (empty-phone fallback), 89 (visible demo hint) ✅
- Route manifest contains `"/[locale]/otp"` ✅

Verdict: PASS (6/6).

## Not covered (browser/manual only — no e2e harness in this repo)

- Register submit success → toast (password no longer printed) → redirect to locale-prefixed `/otp?phone=<number>`.
- `/otp` happy path: enter `123456` → success toast → `/login`; wrong 6-digit code → error toast, stays; fewer than 6 digits → "complete the 6-digit" error.
- Resend button → mock toast; back arrow and "Wrong number?" link → `/register`.
- `/otp` with no/blank `?phone` → fallback card with "Go back to register".
- Visual: single 6-slot group (no separator), one digit per slot, h-12 w-12 slots, centered max-w-md card; refresh keeps phone via query param.
- Per-locale URL rendering (`/km/otp`, `/zh/otp`, …) — manifest proves the route exists, not that each locale renders.

## Notes for Reviewer

- Tester's typed-href prediction confirmed verbatim (see G1); fix was the tester's own suggested one, applied by the orchestrator after the coder's template-literal form failed the gate. Spec deviation documented in `changes.md`.
- The PostToolUse formatter hook reformats whole files on Write/Edit; RegisterForm.tsx (CRLF, non-prettier committed style) was restored and re-edited byte-level via Bash to keep the diff at 4/4 lines. New files are hook-formatted (LF, semicolons) — no lint impact (eslint config has no stylistic rules).
- Web lint's single warning is pre-existing in `AdminLoginForm.tsx` (untouched).
