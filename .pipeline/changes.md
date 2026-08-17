# Changes — OTP verification screen after phone-number registration (mock-wired)

Implements `.pipeline/spec.md`: after register submit, the user is redirected to a new `/otp` screen — a shadcn card with six one-digit input boxes. Verification is a client-side mock (demo code `123456`, no backend call, no SMS); success toasts and routes to `/login`.

## Files

- **NEW `apps/web/components/auth/OtpVerifyForm.tsx`** — `"use client"` component (`{ phone: string }` prop). Self-contained 6-slot OTP card modeled on the dead `OtpForm.tsx` (card/slot/toast idioms) with `useRouter`/`Link` from `@/i18n/routing`. Plain `<form onSubmit>`; <6 digits → error toast; `123456` → success toast + `router.push("/login")`; anything else → invalid-code toast. Resend button is a mock toast. Empty/missing phone renders a fallback card ("No phone number to verify. Please register first.") with a button back to `/register`. `OtpForm.tsx` itself is untouched.
- **NEW `apps/web/app/[locale]/(user)/(auth)/otp/page.tsx`** — server component; awaits `searchParams` (Next 16 Promise convention) and renders `<OtpVerifyForm phone={phone ?? ""} />`. Renders inside the existing `(user)` NavBar/Footer layout; `metadata.title = "Verify Phone"`.
- **EDIT `apps/web/i18n/routing.ts`** — added `"/otp": {}` to the `pathnames` map (after `"/register"`), so the route is locale-aware in all six locales.
- **EDIT `apps/web/components/auth/RegisterForm.tsx`** — behavior-only diff in the live code (lines 316+; the dead commented block above is untouched): added `useRouter` from `@/i18n/routing`; the `if (res.success)` branch now keeps `form.reset()` but replaces the JSON-dump toast (which printed the password on screen) with `toast.success("Registered successfully! We sent a verification code to your phone.")` followed by `router.push({ pathname: "/otp", query: { phone: value.phoneNumber } })`. No JSX/schema/action changes. (Deviation from spec: the spec's template-literal `/otp?phone=…` string form fails next-intl's typed `Href` — caught by the build gate and fixed with the typed object form; net file diff still 4 insertions / 4 deletions.)

## Behavioral diff

- Register submit (success path): before → form reset + toast dumping the full payload including password, stays on page. After → form reset + friendly toast + redirect to `/otp?phone=<encoded>`.
- New route `/[locale]/otp?phone=…`: 6-slot verify card. `123456` → toast → `/login`. Wrong/short code → error toast, stays. Resend → mock success toast. Back arrow / "Wrong number?" link → `/register`. No `?phone` (or blank) → fallback card prompting registration.
- No backend, session, locale-file, or register-design changes.

## Risks / notes for the Tester

- Mock is client-side only: nothing persists; refresh on `/otp` keeps working via the query param. Demo hint `(Demo code: 123456)` is intentionally visible per spec.
- Verify the typed route: `router.push` with a query string against next-intl's `pathnames`-typed `Href` (expected to compile; fallback noted in the coder's self-check if the type gate complains).
- Gates to run: `pnpm --filter web build` (the type gate — web has no `check-types` script) and `pnpm --filter web lint`.
- Follow-ups (out of scope, per spec): real backend wiring, user-session plumbing, resend cooldown, dead-code cleanup (`OtpForm.tsx` + RegisterForm lines 1-314), locale translations.
