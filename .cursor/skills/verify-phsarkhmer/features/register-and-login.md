# Register and log in

A visitor can create an account with a phone number and a password, confirm the
account with a six-digit code, and land on their signed-in profile. An existing
visitor who enters a **local** phone number (`^0\d{7,9}$`) completes the same
code step; a username or email identifier signs in directly without one.

## Sub-features

- `register-submit` validates the form and moves the visitor to the code page.
- `otp-verify` accepts the six-digit dev code and signs the new account in.
- `passcode-setup` unlocks the signed-in app with its account backup passcode.
- `login-existing` signs in an existing account with its identifier + password.

## How to get to it (user POV)

- Choose `Register` in the header, or open `http://localhost:3001/en/register`.
- Submit the registration form (first name, last name, phone, password twice).
- Enter the six-digit code on `…/en/otp`.
- For an existing account, choose `Login` in the header
  (`http://localhost:3001/en/login`) and enter the identifier + password.
  A local phone continues to `/en/otp`; a username/email/E.164 identifier goes
  straight to `/en/me`.

## Driving it with cdp.mjs

Preconditions:

- `scripts/doctor.sh` exits 0.
- The browser is anonymous: `node scripts/cdp.mjs reset`.
- Pick a phone that is not registered in this throwaway database yet
  (`^0\d{7,9}$`, e.g. `012345690`). The demo users occupy `+85589700001…30`
  but were seeded without a password, so they cannot pass the login branch.
- Commands below use the default origin `http://localhost:3001`. If the
  launcher printed a different port (`VERIFY_WEB_PORT`), substitute it.

- **Open the form.** Run
  `node scripts/cdp.mjs open "http://localhost:3001/en/register" --wait-for "form"`.
  The heading is `Register to post free ad` and the form exposes the textboxes
  `First Name*`, `Last Name*`, `Phone Number`, `Password`, `Confirm Password`
  and the button `Submit`.
- **Fill and submit.** Run
  `node scripts/cdp.mjs fill --role textbox --name "First Name" --value "Sokha"`,
  `… --name "Last Name" --value "Verify"`,
  `… --name "Phone Number" --value "<fresh phone>"`,
  `… --name "Password" --value "verify-pass-1"`,
  `… --name "Confirm Password" --value "verify-pass-1"`, then
  `node scripts/cdp.mjs click --role button --name "Submit" --wait-for 'input[autocomplete="one-time-code"]'`.
  The URL becomes `/en/otp?phone=%2B855…` and the title is
  `Verify your phone - PhsarKhmer`; the page names the phone you entered.
- **Enter the code.** The code box is named `Verification code` (the input-otp
  field is labelled):
  `node scripts/cdp.mjs fill --role textbox --name "Verification code" --value "123123"`.
  The form verifies itself when the sixth digit lands; after ~7 s
  `node scripts/cdp.mjs eval "location.pathname"` returns `/en/me` and the page
  shows your first/last name and an `@username`.
- **Unlock the signed-in app.** A dialog titled `Set a backup passcode` covers
  the page. Set one:
  `node scripts/cdp.mjs fill --selector '[role=dialog] input[placeholder="Backup passcode"]' --value "verify-pass"`,
  the same for `[placeholder="Confirm passcode"]`, then
  `node scripts/cdp.mjs click --role button --name "Save passcode"`.
  The dialog closes and the profile is readable; `eval "document.querySelectorAll('[role=dialog]').length"`
  returns `0`.
- **Sign in again (existing account).** Run
  `node scripts/cdp.mjs reset` then
  `node scripts/cdp.mjs open "http://localhost:3001/en/login" --wait-for "form"`,
  fill `Phone Number, Username or Email` with the same local phone and
  `Password` with the same password, and choose `Login`. The flow moves to
  `/en/otp?phone=…`; enter `123123` the same way. The result is `/en/me` again.
  Enter the same credentials as a **username** instead and the same `Login`
  goes directly to `/en/me` with no code step.
- **Duplicate phone.** Re-submitting the registration form with the same phone
  renders an inline alert (quoted below) plus a `Sign in` link; the URL stays
  on `/en/register`. While the request is in flight the button reads
  `Sending…` and is disabled.
- **Proof.** Capture the OTP page and the signed-in profile (after the passcode
  step): `node scripts/cdp.mjs aria --path .cursor/skills/verify-phsarkhmer/artifacts/register-and-login/profile.aria.txt`
  and `node scripts/cdp.mjs shot --path .cursor/skills/verify-phsarkhmer/artifacts/register-and-login/profile.png --full`.
  The snapshot/text must show the account name and `@username`; save the
  commands and their stdout as `commands.txt`.

## Gotchas

- **Field names have no space before the star.** Source renders `First Name*`,
  `Last Name*`, `Phone Number, Username or Email*`, `Password*`. `cdp.mjs`
  matches accessible names by substring, so pass the prefix without the star
  (`--name "First Name"`); the literal `"First Name *"` does not match.
- **The code box is named now.** Use
  `--role textbox --name "Verification code"`. The old fallback
  `input[autocomplete="one-time-code"]` still works.
- **A same-tab refresh keeps the registration handoff.** The password and names
  ride in `sessionStorage`; the OTP page reads them on mount, so a hard reload
  in the same tab does not lose them. `reset`, a new tab, or clearing storage
  does. Do not rely on a refresh to cancel a registration.
- **The form auto-submits at six digits.** Do not also click `Verify` after a
  successful auto-verify — the field has already been reset and the click is a
  no-op (it looks like a failure).
- **A phone can only register once.** Reusing one renders the inline
  `This phone number already has an account.` alert, not a bare error code.
  Vary the number per run. `scripts/cleanup.sh` destroys the database, so
  numbers are free again after a clean cycle. A seeded bare account (no
  password) is the one exception: registering its number completes that account.
- **Only a local phone takes the login OTP path.** `^0\d{7,9}$` goes to
  `/en/otp`; a username, email, or E.164 identifier calls `/auth/login` and
  lands on `/en/me` directly. The label advertises email, but the backend
  matches username or primary phone only.
- **Password rules:** at least 8 characters; the phone must match
  `^0\d{7,9}$` before normalisation to `+855…`.
- **The dev code is `123123`** and only works while the backend runs outside
  `NODE_ENV=production` (it is the `DEV_OTP_TOKEN` the launcher sets). It
  replaces the SMS provider — no real message is sent.
- **The backup passcode is account-scoped.** The dialog appears on a browser
  that holds a backup key for an account with no passcode yet. A fresh run's
  new account always sees it; signing the same account in again does not.
- **Submit with a real pointer click.** In this checkout `press --key Enter`
  did not submit the registration form. Use
  `click --role button --name "Submit"`.
- **`/en/me` has no `<main>` wait target.** A `click … --wait-for "main"` can
  time out after the navigation already succeeded (observed on the username
  login path). Wait for an element the page owns, or re-run `eval` on
  `location.pathname` before treating the click as failed.
