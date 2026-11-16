# Admin dashboard

Staff can sign in to the back office at `/wanderer` and see live marketplace
counts on the dashboard.

## Sub-features

- `admin-login` accepts the seeded `super_admin` credentials and opens the dashboard.
- `dashboard-stats` shows the current new-user, active-post, total-post and
  total-user counts.

## How to get to it (user POV)

- Open `http://localhost:3001/wanderer/login` (also reachable from the
  backoffice subdomain; not localized — no `/en` prefix).
- Enter the admin username and password and choose `Login`.
- Opening `/wanderer/dashboard` without an admin session redirects to
  `/wanderer/login?next=%2Fwanderer%2Fdashboard`.

## Driving it with cdp.mjs

Preconditions:

- `scripts/doctor.sh` exits 0 and reports the seeded database.
- The launcher created the bootstrap admin: `admin` / `verify-admin-2026`
  (role `super_admin`). Do not use a marketplace demo user — those accounts
  were seeded without a password and answer "Invalid username or password".
- No admin session is needed beforehand; a storefront session does not help and
  does not hurt (the cookie pairs are separate).
- Commands below use the default origin `http://localhost:3001`. If the
  launcher printed a different port (`VERIFY_WEB_PORT`), substitute it.
- Run the helper by its skill path
  (`.cursor/skills/verify-phsarkhmer/scripts/…`); there is no repo-root
  `scripts/` directory.

- **Open the login page (and prove the guard).** Run
  `node .cursor/skills/verify-phsarkhmer/scripts/cdp.mjs reset`, then
  `node .cursor/skills/verify-phsarkhmer/scripts/cdp.mjs open "http://localhost:3001/wanderer/dashboard" --wait-for "form"`.
  The URL is `/wanderer/login?next=%2Fwanderer%2Fdashboard`, the title is
  `Login — Admin`, the card is headed `Login to manage ads or post free ad`,
  and the form exposes the textboxes `Phone Number, Username or Email*` and
  `Password*` with the button `Login`.
- **Sign in.** Run
  `node .cursor/skills/verify-phsarkhmer/scripts/cdp.mjs fill --role textbox --name "Phone Number, Username or Email" --value "admin"`,
  `… --name "Password" --value "verify-admin-2026"`,
  and `node .cursor/skills/verify-phsarkhmer/scripts/cdp.mjs click --role button --name "Login"`.
  Then wait for the dashboard (`eval "location.pathname"` returns
  `/wanderer/dashboard`).
  The title is `Dashboard — Admin`.
- **Read the dashboard.** Run
  `node .cursor/skills/verify-phsarkhmer/scripts/cdp.mjs eval '({ title: document.title, heading: document.querySelector("h1")?.textContent.trim(), sidebar: ["Dashboard","Team","Advertisements","Moderation","Reports","Feedback"].every(t => document.body.innerText.includes(t)), brand: document.body.innerText.includes("PhsarKhmer"), management: document.body.innerText.includes("Management"), statLabels: ["New Users","Active Posts","Total Posts","Total Users"].every(t => document.body.innerText.includes(t)) })'`
  (or read the ARIA snapshot). The heading is `DashBoard`, the flags are
  `true`, the sidebar links are `Dashboard`, `Team`, `Advertisements`, the
  collapsible `Reports` button (with `Report Users`/`Report Posts`) and
  `Feedback`, under the group labels `Management` and `Moderation`. The brand
  link reads `PhsarKhmer`. The four stat cards are `New Users` (last-30-day
  signups), `Active Posts`, `Total Posts` (all non-deleted) and `Total Users`;
  the body also renders a `New Users & Listings` chart.
- **Wrong-role refusal (optional spot-check).** Sign in with a credentials-valid
  non-admin account. The form stays on `/wanderer/login` and shows a transient
  toast `This account is not authorized for the admin dashboard`. Because the
  toast expires in ~4 s and `click` waits ~5 s when no navigation happens,
  capture it by installing a MutationObserver on
  `section[aria-label^="Notifications"]` before submitting, as the run did:
  `eval` an expression that observes the notifications region, clicks the
  form's submit button, and resolves with the toast text.
- **Proof.** Capture the dashboard:
  `node .cursor/skills/verify-phsarkhmer/scripts/cdp.mjs aria --path .cursor/skills/verify-phsarkhmer/artifacts/admin-dashboard/dashboard.aria.txt`
  and `… shot --path .cursor/skills/verify-phsarkhmer/artifacts/admin-dashboard/dashboard.png --full`.
  The snapshot shows the sidebar and the stat labels; save the commands and
  their stdout as `commands.txt`.

## Gotchas

- **Counts are live.** On a fresh database the seed fixes the starting point
  (124 listings, ~32 accounts), but any earlier journey in the same run changes
  them. Assert the labels always, and the numbers only when the run is fresh —
  or read the same value from `GET /api/v1/listings`/the throwaway database and
  compare.
- **Wrong role has two different answers.** A credentials-valid non-admin gets
  `This account is not authorized for the admin dashboard` (a toast). A seeded
  demo account, which has no password, gets `Invalid username or password`.
  Do not state the second as the wrong-role message.
- **No locale prefix.** `/wanderer/*` is outside `next-intl`; a `/en/wanderer`
  URL is the storefront's proxy path, not the admin surface. `/wanderer` alone
  has no page and 404s; use `/wanderer/login`.
- **Not super-admin-only.** Both `admin` and `super_admin` roles pass the login
  gate, but they see different sidebars: `super_admin` gets Dashboard, Team,
  Advertisements, Reports, Feedback; `admin` gets Categories, Listings,
  Subcategories, Attributes, Product Specifications, Manage Users and Premium.
  `Management`/`Moderation` are group labels, not links, and there is no
  `PhsarKhmer Management` account row — the header avatar shows the username,
  email and `Role: <role>`.
- **Separate session.** The admin access/refresh cookies are a different pair
  from the storefront's; clearing one does not sign you out of the other. The
  dashboard redirects to the login page when the admin pair is missing or
  expired.
- **Password comes from the launcher.** If a run was launched with a different
  `ADMIN_SEED_PASSWORD`, use that value; changing it requires re-running
  `db:seed`, which the launcher only does for a fresh database.
- **Toasts are transient.** Error feedback is a Sonner toast in
  `section[aria-label^="Notifications"]`, not inline text. A `click` on a
  non-navigating submit blocks ~5 s waiting for a URL change, so the toast can
  be gone before the next command runs. Observe the region before submitting.
