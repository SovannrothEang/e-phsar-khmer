# PhsarKhmer mobile

Expo SDK 58 / React Native 0.88.1 / React 19.3.0 client for PhsarKhmer — expo-router file-based routes, NativeWind 4 (Tailwind 3), React Query 5, Expo Go compatible.

**Status: wired to the real backend** via the staged plan in `tasks/plan-mobile-backend.md`. Auth (phone OTP + password), browse/detail/search, reactions, follows, reports, notifications, the sell flow, manage-ads, profile settings and devices all call the existing NestJS API through `lib/api`.

Chat is implemented end to end: the phone registers as a v2 multi-device E2E device (`lib/e2e/`), so it can exchange encrypted text with the web client and other phones. REST polling is the transport. History **restore** is implemented too — a thread's locked-messages banner opens a passcode prompt (the passcode set on the web), unlocks the account backup key and pulls the encrypted segments; once this phone holds the key the banner says the rows aren't in the backup instead of asking again. Still deferred: encrypted attachments, creating a backup from the phone, and the WebSocket; plus subscriptions/checkout, edit post, scan/QR and follower/following list screens (entry points hidden, mocks kept only where noted above). The Resume (CV) builder is implemented as an 8-step wizard at `/account/resume`, backed by the web's `/resume` API. An existing resume opens the completed-resume overview (section edit links, completion meter, CV and Job Preferences cards); the Create card shows only when none exists, and finishing the wizard also lands on the overview. Its Feedback action opens the mood/section-notes screen backed by the public `/feedback` endpoint. **Social sign-in (Telegram, Facebook, Google) is shown on the auth screens but not wired** — tapping a provider explains that it is unavailable; real OAuth needs a backend redirect allow-list change plus Supabase redirect URLs.

## Setup

This app lives in the pnpm + Turborepo workspace at the repo root. Install from the **repo root**, never with npm inside this directory:

```bash
pnpm install
```

> Do not run `npm install` or `yarn` here. The workspace has no npm lockfile on purpose, and an npm tree would bypass pnpm's linking.

## Run

```bash
pnpm --filter phsarkhmer exec expo start --lan --go
```

Install **Expo Go (SDK 58 — Android client 58.0.5+ / iOS 58.0.7+)** on a phone on the same Wi-Fi and open the `exp://<lan-ip>:8081` URL, or scan the QR from an interactive terminal. Expo Go supports SDK 58 only.

The `start` script is plain `expo start`. Invoking the CLI directly (above) with `--lan --go` is preferred for a physical device: it advertises the LAN URL and opens the project in Expo Go.

### API URL

`lib/api/config.ts` uses `EXPO_PUBLIC_API_URL` when set; otherwise a dev build derives the host from Metro's `hostUri` (`http://<same-host>:3000/api/v1`), so Expo Go reaches the machine without a per-device env. Production must set `EXPO_PUBLIC_API_URL` at build time (it is inlined into the bundle).

## Checks

```bash
pnpm --filter phsarkhmer lint               # expo lint — the only gate this app has
pnpm --filter phsarkhmer exec tsc --noEmit  # type-check (there is no check-types script)
```

CI runs `expo lint` and the repo-wide `prettier --check`; it never type-checks this app, so run `tsc` by hand.

## Layout

| Path          | Contents                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `app/`        | expo-router routes: `(auth)`, `(tabs)`, `(categories)`, `account/` (manage ads, devices, privacy, …) |
| `lib/api/`    | `apiFetch` (envelope, bearer, 401 refresh) + one module per backend resource                         |
| `lib/`        | phone/E.164, listing helpers, sell rules, feed params, card adapter                                  |
| `components/` | UI grouped by domain (auth, category, home, product, common)                                         |
| `contexts/`   | Auth (real session), Reactions, Notifications, Language, Theme                                       |
| `hooks/`      | `useDeviceInfo` and friends                                                                          |
| `services/`   | `authService` — legacy Google/Telegram demo, kept but inert (social sign-in is deferred)             |
| `constants/`  | `AuthConfig`, `Colors`, and mock data used only by the deferred screens under `data/`                |
| `types/`      | Shared types                                                                                         |

## Notes

- `react-native-css-interop` is a **direct** dependency on purpose: pnpm's isolated layout does not expose NativeWind's own copy to Metro, and removing it breaks the bundle.
- `expo-secure-store` keeps the session (memory fallback on web); `expo-image-picker` supplies ad photos (iOS returns JPEG via `preferredAssetRepresentationMode`).
- `android/` and `ios/` are generated by `expo prebuild` and are gitignored; do not commit them.
- **SDK 58 defaults:** New Architecture is the only mode (`newArchEnabled` was removed from `app.json`); Android edge-to-edge is always on (`android.edgeToEdgeEnabled` was removed — the SDK 58 config schema no longer accepts it); `@react-navigation/*` is no longer a direct dependency (import e.g. `useIsFocused` from `expo-router`); the reanimated Babel plugin is no longer listed because `babel-preset-expo` wires `react-native-worklets`.
- **`@types/react`:** the workspace resolves exactly one copy, on the Expo SDK 58 line (`~19.3.0` in `apps/mobile`; `apps/web` and `@repo/ui` declare the same 19.3 line on purpose). A second copy produces two unrelated `React.Ref` types and breaks `apps/web`'s `next build` — that happened when SDK 58 pulled `~19.3.0` while web still resolved 19.2.2, which is why the web/UI type devDependencies now follow Expo's version too. `apps/web`'s React runtime stays on 19.2.4; the React type packages are compile-time only.
