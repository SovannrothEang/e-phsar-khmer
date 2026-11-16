# PhsarKhmer verification map

This directory is the maintained source for verifying the user-facing behavior
of PhsarKhmer. Read this index before driving the app, then use the matching
feature file as the recipe.

## Baseline preconditions

- Launch the stack with `.cursor/skills/verify-phsarkhmer/scripts/launch.sh`
  (fresh bring-up ~30 s; it migrates and seeds an empty database).
- The launcher **forces** the throwaway database (`DATABASE_URL` on
  `localhost:6543`) for migrations, the seed and the API. It never uses the
  `DATABASE_URL` in `apps/backend/.env`, which may name a shared Supabase
  project or the developer's own database. Do not "help" it by editing `.env`.
- Redis is internal to the API. The launcher binds its own container on the
  first free port from 6379 upward and passes that number to the API as
  `QUEUE_PORT`, so another stack's Redis is left alone.
- The web app runs on `http://localhost:3001` by default (English routes under
  `/en`), the API on `http://localhost:8080/api/v1`. If another checkout on
  this machine owns 3001, launch with `VERIFY_WEB_PORT=<free port>` and use the
  origin it prints (also recorded in `/tmp/opencode/verify-phsarkhmer/meta`).
- Seeded data: 12 categories, 146 subcategories, 124 demo listings owned by 30
  demo users, plus `admin` (`super_admin`) and `verify-seed-admin` (`admin`).
  The demo users have no password.
- `scripts/doctor.sh` must exit 0 before any recipe starts. It is the only
  authority on "this instance is worth driving"; it also verifies the API and
  migrations point at the throwaway database and that the ports belong to the
  launch session.
- Never drive an instance this skill did not start. The launcher refuses to
  share 3001/8080/6543/9333, and two instances cannot coexist here.

## Driving conventions

- Start every recipe from its stated preconditions; start anonymous journeys
  with `node scripts/cdp.mjs reset` (clears cookies and web storage).
- Prefer accessible names (`--role` + `--name`) over CSS. Use a selector only
  for elements that have no accessible name yet — listing cards are unnamed,
  and that is itself worth reporting if a change is supposed to fix it. The OTP
  input _is_ named now (`Verification code`).
- Form labels render as `First Name*` (no space before the star). `cdp.mjs`
  matches by substring, so pass the prefix (`--name "First Name"`); the literal
  `"First Name *"` does not match.
- Treat every command as literal; keep flags and quoted names unchanged.
- `cdp.mjs` coordinates are viewport coordinates and re-measured on every
  action, so window size does not matter — but call `open` again after a
  client-side redirect if the page looks half-rendered.
- A `click` with no navigation waits ~5 s for a URL change, so a short-lived
  toast can expire before the next command. To prove a toast, observe
  `section[aria-label^="Notifications"]` in the same expression that submits.
- The phone-OTP dev code is `123123`. It replaces the SMS provider only while
  the backend runs outside production. No other mocking is allowed at the
  browser boundary.
- Login takes the code step only for a local phone (`^0\d{7,9}$`); a username
  or email signs in directly at `/en/me`.
- Prices render per surface: feed cards `$2,350`, the detail page `$2350` (no
  separator) or `Negotiable`.
- Use the seeded English locale (`/en`). Khmer (`/km`) duplicates accessible
  names ("Cars For Sale Cars For Sale") and is verified only when a change is
  about localization. English duplicates subcategory names too while the seeded
  icons are null, so prefer substring matches.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof = ARIA snapshot + full-page screenshot with the app identity
  visible, plus the command trace (`commands.txt`) in the same directory.
- A write is proven by a second view: re-open the page or read the API/DB. A
  toast is not proof.
- Record the feature ID and entry point used with every artifact.
- Report an unreachable entry point with the attempted command and the unmet
  precondition. Do not report one entry point as verified through another.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the
user-visible behavior. It then uses exactly four H2 sections in this order:

1. `Sub-features` — short IDs, one line per behavior.
2. `How to get to it (user POV)` — every user entry point.
3. `Driving it with cdp.mjs` — starts with `Preconditions:` then labeled
   bullets pairing each user action with an exact command and an observable
   result.
4. `Gotchas` — traps that can waste or invalidate a run.

Keep implementation details out of the map. Name only user paths, stable
handles, required state, commands, and observable proof.

## Features

- [Browse and search](./browse-and-search.md) — home feed, category page,
  listing detail, keyword search, and the no-match state (anonymous).
- [Register and log in](./register-and-login.md) — phone registration, OTP
  verification with the dev code, the account passcode, and the signed-in
  profile.
- [Admin dashboard](./admin-dashboard.md) — `/wanderer` admin login and the
  dashboard's live counts.
