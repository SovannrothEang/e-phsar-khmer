---
name: verify-phsarkhmer
description: Drive the real PhsarKhmer marketplace — the Next.js storefront on :3001, its NestJS API on :8080, and the /wanderer admin dashboard — to prove user-facing behavior (browse/search ads, register and log in with phone OTP, admin login) and capture ARIA snapshots plus screenshots as evidence. Use whenever a change must be checked in the running app rather than only through unit tests.
---

# Verify PhsarKhmer

This skill turns a code change into evidence from the running app: launch the
real stack, drive a user path with a headless browser, capture what the user
sees, and tear everything down without touching the shared development
database.

- **Surface in scope:** `apps/web` — the Next.js 16.2.3 storefront at
  `http://localhost:3001` and the `/wanderer` admin dashboard served by the
  same app. `apps/backend` (NestJS, `http://localhost:8080/api/v1`) is the API
  those pages call.
- **Out of scope:** `apps/mobile` (Expo). There is no emulator on this machine;
  do not claim a mobile journey was verified.
- **Proof of record:** an accessibility snapshot, a screenshot, and the
  command trace that produced them, under `artifacts/<feature>/`.
- **Feature recipes:** `features/` — read `features/README.md` first.

## Launch

```bash
.cursor/skills/verify-phsarkhmer/scripts/launch.sh
```

It brings up, in order: a Redis container (`psa-verify-redis`) on the first
free port from 6379 upward; an isolated Postgres container
(`psa-verify-postgres`, :6543); then — only on a fresh database — migrations, a
listings-seed fixture account, and the seed (12 categories, 146 subcategories,
124 demo listings owned by 30 demo users, plus the two seeded staff accounts);
then the API (`pnpm --filter backend dev`, :8080) and the web app
(`next dev --webpack`, :3001 by default).

The launcher **forces** the throwaway database for migrations, the seed and the
API by passing `DATABASE_URL=postgresql://postgres:postgres@localhost:6543/phsar_db`.
Whatever `apps/backend/.env` names — a shared Supabase project or the
developer's own database on 5432 — is never migrated, seeded or driven. Redis
is likewise dedicated: the API receives the chosen port as `QUEUE_PORT`, so a
Redis another stack owns on 6379 is left alone.

Fresh bring-up takes ~30 s. The command is idempotent: anything already healthy
and started by this skill is reused, and anything it did not start is left
alone (it aborts instead of sharing a port).

If another checkout on this machine already owns 3001, move the storefront:

```bash
VERIFY_WEB_PORT=3010 .cursor/skills/verify-phsarkhmer/scripts/launch.sh
```

The printed origin (also recorded in `/tmp/opencode/verify-phsarkhmer/meta`)
is what every recipe must use.

**Ready means all three:** `GET http://localhost:8080/health` answers
`"db":"up"`, `GET http://localhost:8080/api/v1/categories` returns
`"success":true`, and `GET <web-origin>/en` returns 200 with the app shell
(`PhsarKhmer`) in the body. A port answering is not enough — a dev server
with a half-written `.next/dev` answers 200 on some routes and
`Internal Server Error` on others.

First run on this checkout (or after restoring `node_modules`):

```bash
CI=true SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm install
```

This checkout's `node_modules` was restored from a Windows machine: native
modules are PE32 binaries and the `.bin` shims are not executable, so nothing
starts until a Linux install replaces them. `pnpm-lock.yaml` must stay
unchanged afterwards (`git status --porcelain pnpm-lock.yaml`).

Values a recipe can rely on (all fixed by `scripts/launch.sh`, except the two
ports it selects):

| Thing              | Value                                                        |
| ------------------ | ------------------------------------------------------------ |
| Storefront         | `http://localhost:3001/en` (or the `VERIFY_WEB_PORT` origin) |
| Admin dashboard    | `<web-origin>/wanderer/login`                                |
| API                | `http://localhost:8080/api/v1` (Swagger at `/api/docs`)      |
| Throwaway database | `postgresql://postgres:postgres@localhost:6543/phsar_db`     |
| Verify Redis       | `localhost:<first free 6379+>` (API gets it as `QUEUE_PORT`) |
| Phone-OTP dev code | `123123` (backend runs with `DEV_OTP_TOKEN=123123`)          |
| Seeded admin login | `admin` / `verify-admin-2026` (role `super_admin`)           |
| Run state / logs   | `/tmp/opencode/verify-phsarkhmer/`                           |

Teardown: `scripts/cleanup.sh` (below). Never leave a run's containers and
servers behind — the next run's ports are the same.

## Doctor

```bash
.cursor/skills/verify-phsarkhmer/scripts/doctor.sh
```

Read-only. Exits 0 only when the instance is worth driving: launcher record
present, backend and web processes alive **and the port owners belong to the
launch session**, `/health` reports `db:up`, the categories API answers, `/en`
renders the app shell, Redis answers `PING`, Postgres has the schema and seed
data **and the launch record points the API/migrations at it**, and the browser
state is either reachable or absent. It prints the commit, Node and Next
versions, the selected web/Redis ports, and `INFO` lines that are not failures
(for example "headless chromium not running").

Run it whenever anything looks off — after a laptop sleep, after editing app
code while `next dev` was running, or before trusting evidence. Never "repair"
by driving an instance the doctor failed: relaunch instead.

## Drive

Everything goes through `scripts/cdp.mjs`, a dependency-free driver for the
headless Chromium + raw CDP recipe documented in `ARCHITECTURE.md` → _Browser
verification_. It uses only Node's built-in `fetch`/`WebSocket`; no Playwright.

```bash
CDP=.cursor/skills/verify-phsarkhmer/scripts/cdp.mjs

node $CDP open "http://localhost:3001/en" --wait-for "main"   # navigate + hydrate
node $CDP reset                                              # clear cookies/storage
node $CDP aria  --path artifacts/<feature>/home.aria.txt      # accessibility tree
node $CDP shot  --path artifacts/<feature>/home.png --full    # full-page PNG
node $CDP eval  "document.title"                              # any page expression
node $CDP fill  --role searchbox --name "Search" --value "Honda"
node $CDP click --role button --name "Search"
node $CDP fill  --role textbox --name "Verification code" --value "123123"
node $CDP press --key Escape
node $CDP state
node $CDP close                                               # kill only our chromium
```

Rules that keep a run honest:

- Find elements by **accessible name first** (`--role` + `--name`), then by a
  stable selector when the element is unnamed (listing cards). The OTP input is
  named `Verification code`; form labels render as `First Name*`, and
  `--name` matches by substring, so pass the prefix without the star.
- `click` drives a real pointer sequence (mousedown held ~350 ms) because Radix
  triggers open on pointerdown; a synthetic `click()` silently does nothing.
  It also waits for the URL to change before reporting, because a client-side
  navigation commits only after the RSC payload resolves (~1–2 s on a cold dev
  route) — the printed URL is the page you are actually on. On a non-navigating
  submit that wait is ~5 s, long enough for a short-lived toast to disappear;
  observe the notifications region in the same expression that submits when a
  toast is the proof.
- Clicks happen after hydration (network-quiet + a fixed cushion). If a click
  still lands on a dead page, re-`open` with `--wait-for` instead of adding
  sleeps blindly. Some routes (`/en/me`) have no `<main>`; a `--wait-for "main"`
  can time out after the navigation already succeeded — re-check
  `location.pathname` before calling the drive failed.
- Start anonymous journeys with `reset`; signed-in state from an earlier step
  changes what the page shows.

## Evidence

Write proof to `.cursor/skills/verify-phsarkhmer/artifacts/<feature>/`
(gitignored). One directory per feature; name files after the step.

A proof is complete when it contains:

- **The action and its result**, not just the final screen — e.g. the filled
  search box _and_ the results heading, or the OTP page _and_ the profile page.
- **An ARIA snapshot and a screenshot** of the asserted state
  (`cdp.mjs aria --path …`, `cdp.mjs shot --path … --full`).
- **The command trace**: the `cdp.mjs` commands you ran and the important
  stdout (URL, heading, counts), saved as `commands.txt` next to the artifacts.
- **A second, independent view of side effects** when the journey writes:
  re-open the affected page, or read the API/DB (`psql` into the throwaway
  container) — not just the toast that said it worked.
- **No mocks at the browser boundary.** Test-only endpoints and internal
  setters are not proof of a user path. The phone-OTP dev code is the one
  sanctioned shortcut: it replaces the SMS provider (a production boundary),
  it is ignored when `NODE_ENV=production`, and it is what a human would
  otherwise need a phone for.

Report an unreachable path with the exact command and the unmet precondition.
Do not report one entry point as verified because a different one worked.

## Cleanup

```bash
.cursor/skills/verify-phsarkhmer/scripts/cleanup.sh
```

Stops the backend and web sessions the launcher created (whole session, so
`nest`'s detached app child and Next's workers go too), removes
`psa-verify-redis` and `psa-verify-postgres` **with their volumes** (the
database is throwaway), closes the headless browser, and deletes run state.
It refuses to kill anything whose command line does not point at this repo.
Proof artifacts are never touched. Re-running it is safe.

After cleanup, confirm the evidence still exists and the ports are free:

```bash
ls .cursor/skills/verify-phsarkhmer/artifacts/<feature>/
ss -ltn | grep -E ':(3001|8080|6379|6543|9333)\b' || echo "ports free"
```

## Gotchas specific to this machine

- **Turbopack dev is broken here.** `pnpm --filter web dev` (Next 16.2.3)
  dies with _"couldn't find the Next.js package (next/package.json) from the
  project directory …/apps/web/app"_. `turbopack.root`, a root-level
  `next.config.ts` value, and an `app/node_modules/next` symlink were all
  tried and none helped. `next dev --webpack` works and is what the launcher
  uses. CI's `next build` is unaffected.
- **`apps/backend/.env` is not the verification target.** It currently points
  `DATABASE_URL` at `localhost:5432/phsar_db` and holds real Supabase/PlasGate
  credentials. The launcher overrides `DATABASE_URL` for migrate/seed/API and
  passes `QUEUE_PORT` for its own Redis; the credentials stay because the app
  requires them at boot. Never drive a run against `.env`'s database.
- **Ports 8080 (API), 6543 (DB) and 9333 (CDP) are fixed.** 3001 is the
  default storefront port but moves with `VERIFY_WEB_PORT`; Redis moves
  automatically to the first free port. The launcher aborts rather than share
  any of them, and a second checkout (worktree) cannot be verified here at the
  same time without a different web port.
- **The database is throwaway.** The launcher only accepts 6543 if nothing
  else owns it and cleanup deletes the container. Never point a run at a real
  Supabase project.
- **Photo seeding is off by default.** `db:seed` otherwise uploads demo photos
  into the Supabase Storage bucket named in `apps/backend/.env`. With
  `VERIFY_SEED_PHOTOS=1` the launcher allows it (opt in deliberately — it
  writes to a shared bucket). Without it, cards render the app's designed
  "no image" fallback; that is expected, not a defect.
- **`nest start --watch` runs its app in a detached child.** The launcher
  records the `setsid` session leader, not the pid holding :8080. A stray
  watcher from an earlier manual run can steal the port during a restart and
  serve stale config — that is the main reason `doctor.sh` checks that the
  port owner is inside the recorded session, and why cleanup kills the whole
  session.
- **`next dev` state rots if it is killed mid-compile.** Every page then 500s
  with `ENOENT …/.next/dev/routes-manifest.json`; the launcher removes
  `.next/dev` before starting, and `doctor.sh` fails on a shell-less 200.
- **Raw `curl` sees almost nothing.** The storefront renders client-side; HTML
  greps only find the flight payload. Use the browser for UI claims; `curl` is
  fine for the API and for readiness checks.
- **Error toasts are transient.** The admin login and other forms report
  failures in Sonner's `section[aria-label^="Notifications"]`, not inline text,
  and the toast expires in ~4 s. A `click` on a non-navigating submit spends
  ~5 s waiting for a URL change, so the toast can be gone by the next command.
  Observe the region in the same expression that submits, or use inline
  feedback where the form provides it (the duplicate-phone registration alert).
- **Scripts are executable.** If `launch.sh` reports "Permission denied", the
  checkout lost the mode bits; `chmod +x scripts/*.sh scripts/cdp.mjs`.

## Helpers

| File                    | What it is for                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `scripts/launch.sh`     | Start/reuse the whole stack; migrates and seeds a fresh DB; picks free ports       |
| `scripts/doctor.sh`     | Read-only "is this instance worth driving?" — exit 0 = yes                         |
| `scripts/cdp.mjs`       | Headless Chromium driver: `open/eval/click/fill/press/aria/shot/reset/state/close` |
| `scripts/cleanup.sh`    | Stop the launched sessions, delete containers + volumes, keep artifacts            |
| `features/README.md`    | Baseline preconditions, driving conventions, proof rules                           |
| `features/<feature>.md` | One recipe per user-facing feature                                                 |

## Feature map

Start at [`features/README.md`](features/README.md):

- [`browse-and-search.md`](features/browse-and-search.md) — home feed, category
  page, listing detail, search match and empty state (anonymous).
- [`register-and-login.md`](features/register-and-login.md) — phone
  registration, OTP dev code, account passcode, signed-in profile, and the
  phone/username login branches.
- [`admin-dashboard.md`](features/admin-dashboard.md) — `/wanderer` login and
  dashboard stats.

Keep the map honest as the app changes with `/maintain-verification-skill`.
