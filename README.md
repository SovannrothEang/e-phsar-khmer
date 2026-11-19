# PhsarKhmer

Marketplace for buying and selling in Cambodia. This repo contains three apps:

- `apps/backend` — NestJS API (port 3000)
- `apps/web` — Next.js website (port 3001)
- `apps/mobile` — Expo React Native app

## Requirements

- Node.js 22 (22.12 or newer)
- pnpm 9.0.0
- Git
- Docker (optional — only used to run Redis)
- Windows users: use WSL2

Turbo comes with the project. You do not need to install it.

## Setup

### 1. Install pnpm

```bash
npm install -g pnpm@9.0.0
pnpm --version   # should print 9.0.0
```

### 2. Clone the project

```bash
git clone https://github.com/sakkunasuon2014/e-phsar-khmer.git
cd e-phsar-khmer
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Create the backend environment file

```bash
cp apps/backend/.env.example apps/backend/.env
```

Ask the team for the values. At minimum you need:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

Payments, SMS and storage uploads need their own keys too — see the comments in `apps/backend/.env.example`.

### 5. Start Redis

```bash
docker run --rm -d -p 6379:6379 redis:7-alpine
```

### 6. Create the database

```bash
pnpm --filter backend db:migrate
pnpm --filter backend db:seed
```

### 7. Start the backend

```bash
pnpm --filter backend start:dev
```

Check it works: <http://localhost:3000/health>

### 8. Start the web app

In a second terminal:

```bash
pnpm --filter web dev
```

Open <http://localhost:3001>.

## Mobile app (optional)

Install **Expo Go (SDK 58)** on your phone, put the phone on the same Wi-Fi, then:

```bash
pnpm --filter phsarkhmer exec expo start --lan --go
```

Scan the QR code. You do not need Android Studio for Expo Go.

A native build (`pnpm --filter phsarkhmer android`) needs JDK 17 and the Android SDK. iOS native builds need macOS.

## Useful commands

```bash
pnpm build                 # build every package
pnpm lint                  # lint every package
pnpm format:check          # check formatting (same check as CI)
pnpm --filter backend test
pnpm --filter web test
pnpm --filter phsarkhmer lint
```

## Troubleshooting

- **`sharp` fails during install on Linux** — run `SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm install`.
- **Backend crashes on boot** — check Node is 22.12 or newer. Older Node cannot load some dependencies.
- **Chat messages never arrive** — `NEXT_PUBLIC_WS_URL` in the web env must use the same host as `API_URL`.
- **Uploads fail with 415 or 413** — a Supabase storage bucket setting; ask the team.
- **Native modules are missing after install** — you are probably on pnpm 10; use 9.0.0.

## More docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the system works
- [AGENTS.md](AGENTS.md) — coding rules
- [CHANGELOG.md](CHANGELOG.md) — what changed and when
- `apps/backend/src/*/README.md` — per-module details (payment, chat, files, otp)
