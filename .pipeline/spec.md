# Spec: OTP verification screen after phone-number registration (user surface, mock-wired)

## Summary

After a user submits the register form, redirect them to a new `/otp` verification screen: a shadcn-style card with six input boxes accepting exactly one digit each. Verification is mocked at the client level (fixed demo code `123456`, no backend call, no SMS); success shows a toast and sends the user to `/login`. The register page's design is untouched — only the submit-success branch gains a redirect.

## Current state (answers to the captain's questions)

- **Do we have an OTP screen/page after login/register by phone?** No. The user surface has no OTP route. `apps/web/app/[locale]/(user)/(auth)/` contains only `login`, `register`, `forgot-password`, and `test` pages. `forgot-password/page.tsx` renders `ForgotPasswordForm` (`apps/web/components/auth/Forgot-PassowordForm.tsx`), which is a plain identifier input — no OTP step exists anywhere on the user surface.
- **Do we have an OTP component?** Partially. `apps/web/components/auth/OtpForm.tsx` exports `InputOTPForm` — a 6-slot card built on the shadcn primitives in `apps/web/components/ui/input-otp.tsx` (`input-otp@^1.4.2` already in `apps/web/package.json` line 24 — not a new dependency). But it is dead code: nothing imports it, its copy is Telegram/email-specific ("sent a verification code via Telegram" lines 72-73; "I no longer have access to this email address" line 119), and its props (`expectedOtp`, `onSuccess`, `onBack` supplied by a parent, lines 28-33) do not fit a standalone page.
- **Is the existing OtpForm enough, even as mockup?** As a structural template, yes — it proves the 6-slot one-digit-per-box UI works. As the actual screen, no: it has no route, no phone display, mismatched copy, and expects a parent to own verification and navigation. We build a purpose-built `OtpVerifyForm` modeled on it.
- **Register today:** `apps/web/app/[locale]/(user)/(auth)/register/page.tsx` (server component, 12 lines) renders `RegisterForm` — the live code is `apps/web/components/auth/RegisterForm.tsx` lines 316-427 (the commented block above it, lines 1-314, is dead). Submit calls the `register()` server action (`apps/web/actions/register.ts`), a mock (`// Save to DB` then `{ success: true }`). On success it currently calls `form.reset()` and dumps the whole payload — including the password — into a toast (lines 365-370). No redirect exists.
- **Backend contract mismatch (why mock):** backend `POST /api/v1/auth/register` accepts only `{ phone }`; the web form collects firstName/lastName/password/confirmPassword. The form cannot be persisted through the existing contract without backend changes (out of scope), and the captain explicitly accepted mockup.
- **i18n reality:** auth pages use hardcoded English — `LoginForm.tsx`, `RegisterForm.tsx`, `Forgot-PassowordForm.tsx` contain no `useTranslations`, and `apps/web/messages/en.json` (59 lines) has only `HomePage` and `Card` sections. No auth/register message keys exist in any of the 6 locale files to mirror. New OTP copy therefore stays hardcoded English; no locale files change.

## Decisions

1. **Route: `/otp`** — page at `app/[locale]/(user)/(auth)/otp/page.tsx`, declared as `"/otp": {}` in `i18n/routing.ts` pathnames, mirroring the sibling `"/login"` / `"/register"` / `"/forgot-password"` entries (lines 18-20).
2. **Wiring level: client-side mock.** Fixed demo code `123456`; no server action, no backend call, no SMS. Rationale: the register action is already a mock; the backend register endpoint cannot accept this form's payload; the captain explicitly allowed mockup ("even if it mock up?"). A small visible hint `(Demo code: 123456)` makes the mock testable.
3. **Phone hand-off: query param** — `/otp?phone=<encodeURIComponent(phone)>`. Survives refresh, debuggable, no sessionStorage plumbing. The server page awaits `searchParams` (Next 16 Promise convention — `app/[locale]/layout.tsx` line 36 awaits `params` the same way) and passes `phone` as a prop, avoiding `useSearchParams` prerender/Suspense concerns.
4. **Success redirect: `/login`.** The mock creates no session, and the register design already steers users to login. Locale-aware `router.push("/login")` via `useRouter` from `@/i18n/routing` (pattern: `LoginForm.tsx` lines 18, 43).
5. **New component, not a retrofit.** `InputOTPForm` is unused dead code with Telegram/email copy and parent-driven props; a self-contained `{ phone }`-prop component fits a standalone page. `OtpForm.tsx` is left untouched (minimal diff).
6. **Visual: shadcn card, one group of 6 slots.** `InputOTP` with `maxLength={6}` enforces exactly one digit per box (the library's core behavior — no extra code needed). Single `InputOTPGroup` of six `InputOTPSlot`s, no 3+3 separator ("simple and clean"); slot sizing `h-12 w-12 text-xl` copied from `OtpForm.tsx` lines 104/110. Card structure and container copied from `OtpForm.tsx`.
7. **Resend + back affordances, mocked.** Resend Code button → `toast.success("Code resent successfully!")` (exact pattern `OtpForm.tsx` line 89). Back = ghost icon Button with ArrowLeft plus a "Wrong number?" `Link href="/register"` via `Link` from `@/i18n/routing` (`LoginForm.tsx` line 144 pattern).
8. **i18n: hardcoded English**, matching every other auth component. No `messages/*.json` edits.

## Implementation plan

1. **EDIT `apps/web/i18n/routing.ts`** — add `"/otp": {}` immediately after the `"/register": {}` entry (line 19). Empty object = identical path in all six locales.

2. **NEW `apps/web/components/auth/OtpVerifyForm.tsx`** — `"use client"` component; copy card/slot/toast idioms from `components/auth/OtpForm.tsx`, router/Link idiom from `components/auth/LoginForm.tsx`.
   - Props: `{ phone: string }` (may be empty string). State: `const [value, setValue] = useState("")`. `const router = useRouter()` from `@/i18n/routing`.
   - `handleSubmit(e)`: `preventDefault()`; if `value.length < 6` → `toast.error("Please enter the complete 6-digit verification code.")`; else if `value === "123456"` → `toast.success("Phone number verified successfully!", { position: "top-right" })` then `router.push("/login")`; else → `toast.error("Invalid verification code. Please try again.")`.
   - Empty-phone edge: if `!phone.trim()`, render the same Card with only a message ("No phone number to verify. Please register first.") and a Button/Link back to `/register` — no OTP input.
   - Layout: `Card className="mx-auto max-w-md w-full bg-card p-2"`; CardHeader with back-arrow ghost Button (`onClick={() => router.push("/register")}`), CardTitle "Verify your phone", CardDescription "We sent a 6-digit verification code to {phone}. Enter it below to complete your registration. (Demo code: 123456)"; CardContent: `Field` + `FieldLabel` "Verification code" with right-aligned outline Resend Button (RefreshCwIcon, mock toast) + centered `InputOTP maxLength={6} required` holding six `InputOTPSlot`s in one `InputOTPGroup` (slot classes `*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:text-xl`); CardFooter: full-width submit Button `bg-orange-500 hover:bg-orange-600 text-white h-10` labeled "Verify" (matches `OtpForm.tsx` line 125), and a muted "Wrong number? Go back to register" `Link href="/register"`.
   - Plain `<form onSubmit={handleSubmit}>` exactly like `OtpForm.tsx` — no form library, no loading state (instant mock).

3. **NEW `apps/web/app/[locale]/(user)/(auth)/otp/page.tsx`** — server component following `register/page.tsx` (metadata + single component render):

   ```tsx
   import type { Metadata } from "next";
   import { OtpVerifyForm } from "@/components/auth/OtpVerifyForm";

   export const metadata: Metadata = { title: "Verify Phone" };

   export default async function OtpPage({
     searchParams,
   }: {
     searchParams: Promise<{ phone?: string }>;
   }) {
     const { phone } = await searchParams;
     return <OtpVerifyForm phone={phone ?? ""} />;
   }
   ```

   Renders inside the existing `(user)` NavBar/Footer layout (no new layout file; register renders there too).

4. **EDIT `apps/web/components/auth/RegisterForm.tsx`** — behavior-only change, zero JSX/design edits:
   - Add `import { useRouter } from "@/i18n/routing"` and `const router = useRouter()` inside `RegisterForm` (LoginForm lines 18/26 pattern).
   - In `onSubmit`'s `if (res.success)` branch (lines 365-370): keep `form.reset()`; replace the JSON-dump toast (it renders the password on screen) with `toast.success("Registered successfully! We sent a verification code to your phone.")`; then add `router.push(`/otp?phone=${encodeURIComponent(value.phoneNumber)}`)`.
   - Leave the mock `register()` action, validation, schema, and all JSX untouched.

5. **Verify:** `pnpm --filter web build` (the type gate — web has no `check-types` script) and `pnpm --filter web lint`.

## Out of scope / follow-ups

- **Real backend wiring:** needs backend changes first — register accepts only `{ phone }` (no name/password), so either the backend grows a richer register contract or the web form collapses to phone-only before `POST /api/v1/auth/otp/verify` (which exists and returns tokens) can be called for real.
- **User-surface session plumbing:** `setUserSession` + a user-surface fetch helper (`serverFetch` reads admin cookies only) so a real verify can log the user in directly instead of routing to `/login`.
- **Resend cooldown/countdown and real SMS/Telegram channel copy** once a provider is wired.
- **Cleanup of dead code:** `OtpForm.tsx`'s unused `InputOTPForm` and the commented block in `RegisterForm.tsx` lines 1-314 — separate ticket, not this diff.
- **Locale translations** for OTP copy once the auth surface adopts next-intl keys (entire auth surface is English-only by current convention).

## Open questions

None.
