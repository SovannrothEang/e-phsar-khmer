#!/usr/bin/env bash
# Bring up exactly one verifiable PSA stack: Redis, an isolated Postgres, the
# NestJS API and the Next.js web app.
#
# Idempotent: re-running reuses whatever is already healthy and never touches a
# process or container it did not start. The API/DB/CDP ports are fixed; the
# storefront port can move with VERIFY_WEB_PORT and Redis picks a free port, so
# this run never shares a port with another checkout — see SKILL.md.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$SCRIPT_DIR/../../../.." && pwd)
RUN_DIR=${VERIFY_RUN_DIR:-/tmp/opencode/verify-phsarkhmer}
LOGS="$RUN_DIR/logs"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"
META_FILE="$RUN_DIR/meta"

BACKEND_PORT=8080
# The storefront port is 3001 by default. `VERIFY_WEB_PORT` moves it when
# another checkout on this machine already owns 3001 (the launcher refuses to
# share a port); the value is recorded in the run state so doctor.sh follows it.
WEB_PORT=${VERIFY_WEB_PORT:-3001}
REDIS_CONTAINER=psa-verify-redis
POSTGRES_CONTAINER=psa-verify-postgres
LABEL=verify.phsarkhmer=1
DB_NAME=phsar_db
# The verification database is ALWAYS this throwaway container. It is passed to
# migrations, the seed and the API explicitly, because apps/backend/.env may
# name a shared Supabase project or the developer's own database on another
# port. A run must never migrate, seed, or drive the database .env names.
DB_PORT=6543
DATABASE_URL="postgresql://postgres:postgres@localhost:$DB_PORT/$DB_NAME"
# Redis is an internal dependency of the API (BullMQ, lockout, limiters). The
# verify Redis binds the first free port from 6379 upward and hands that number
# to the API through QUEUE_PORT, so a Redis another stack already owns on 6379
# is left untouched.
REDIS_PORT_BASE=6379
REDIS_PORT=
# Dev-only OTP bypass accepted by POST /auth/otp/verify (ignored when
# NODE_ENV=production). Fixed so feature recipes can name it literally.
DEV_OTP_TOKEN=123123
# Seeded super_admin password (also used by the /wanderer admin login).
ADMIN_PASSWORD=verify-admin-2026

mkdir -p "$RUN_DIR" "$LOGS"

say() { printf '%s\n' "$*"; }
die() {
  printf 'LAUNCH FAILED: %s\n' "$*" >&2
  exit 1
}

port_pid() { # prints the pid listening on a TCP port, if it is ours to see
  ss -ltnpH "sport = :$1" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | head -1
}

port_busy() { # any listener on the port, even one whose pid we cannot see
  ss -ltnH "sport = :$1" 2>/dev/null | grep -q .
}

port_owned_by_us() { # port, pid-file
  local port=$1 file=$2 pid owner owner_sid
  [ -f "$file" ] || return 1
  pid=$(cat "$file")
  kill -0 "$pid" 2>/dev/null || return 1
  owner=$(port_pid "$port")
  [ -n "$owner" ] || return 1
  # `next dev` and `nest start --watch` bind the port from a child process —
  # nest even puts its app in a new process group. setsid makes the recorded
  # pid the *session* leader, and every descendant inherits that session id.
  owner_sid=$(ps -o sid= -p "$owner" 2>/dev/null | tr -d ' ')
  [ "$owner_sid" = "$pid" ]
}

pid_alive() { # pid-file
  [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null
}

wait_until() { # description, timeout-seconds, command...
  local desc=$1 timeout=$2 deadline
  shift 2
  deadline=$(($(date +%s) + timeout))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if "$@" >/dev/null 2>&1; then
      say "  ✓ $desc"
      return 0
    fi
    sleep 2
  done
  say "  ✗ $desc (timed out after ${timeout}s)"
  return 1
}

backend_healthy() {
  local health
  health=$(curl -fsS -m 5 "http://localhost:$BACKEND_PORT/health" 2>/dev/null) || return 1
  case "$health" in
    *'"db":"up"'*) return 0 ;;
  esac
  return 1
}

web_healthy() {
  [ "$(curl -s -o /dev/null -m 90 -w '%{http_code}' "http://localhost:$WEB_PORT/en")" = "200" ]
}

db_seeded() {
  local count
  count=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$DB_NAME" -tAc \
    "select count(*) from categories" 2>/dev/null) || return 1
  count=$(printf '%s' "$count" | tr -d '[:space:]')
  [ -n "$count" ] && [ "$count" -gt 0 ] 2>/dev/null
}

container_label() { # container -> label value, empty when absent
  docker inspect -f '{{ index .Config.Labels "verify.phsarkhmer" }}' "$1" 2>/dev/null || true
}

# ---------------------------------------------------------------- preconditions

[ -d "$REPO/node_modules" ] && [ -d "$REPO/apps/backend/node_modules" ] &&
  [ -d "$REPO/apps/web/node_modules" ] ||
  die "dependencies are missing. Install them first:
  CI=true SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm install"

[ -f "$REPO/apps/backend/.env" ] ||
  die "apps/backend/.env is required (DATABASE_URL, SUPABASE_* keys, JWT secrets)."

command -v docker >/dev/null ||
  die "docker is required for Redis and the isolated Postgres."
command -v curl >/dev/null || die "curl is required."

say "Launching PSA verification stack (repo: $REPO)"

# ----------------------------------------------------------------------- redis

if docker inspect "$REDIS_CONTAINER" >/dev/null 2>&1; then
  [ "$(container_label "$REDIS_CONTAINER")" = "1" ] ||
    die "container $REDIS_CONTAINER exists but was not created by this skill; refusing to touch it."
  docker start "$REDIS_CONTAINER" >/dev/null 2>&1 || true
  REDIS_PORT=$(docker port "$REDIS_CONTAINER" 6379/tcp 2>/dev/null |
    head -1 | sed -n 's/.*:\([0-9][0-9]*\)$/\1/p')
  REDIS_PORT=${REDIS_PORT:-$REDIS_PORT_BASE}
  say "  ✓ reusing redis container on :$REDIS_PORT"
else
  if [ -n "${VERIFY_REDIS_PORT:-}" ]; then
    if port_busy "$VERIFY_REDIS_PORT"; then
      die "VERIFY_REDIS_PORT=$VERIFY_REDIS_PORT is already in use; pick a free port."
    fi
    REDIS_PORT=$VERIFY_REDIS_PORT
  else
    for candidate in $(seq "$REDIS_PORT_BASE" $((REDIS_PORT_BASE + 20))); do
      if ! port_busy "$candidate"; then
        REDIS_PORT=$candidate
        break
      fi
    done
    [ -n "$REDIS_PORT" ] ||
      die "no free port in $REDIS_PORT_BASE-$((REDIS_PORT_BASE + 20)) for the verify Redis."
  fi
  docker run -d --name "$REDIS_CONTAINER" --label "$LABEL" \
    -p "$REDIS_PORT:6379" redis:7-alpine >/dev/null ||
    die "could not start the redis container on port $REDIS_PORT (image pull failed?)"
  say "  ✓ started redis container on :$REDIS_PORT"
fi
wait_until "redis answers PING" 30 docker exec "$REDIS_CONTAINER" redis-cli ping ||
  die "redis did not become ready."

# -------------------------------------------------------------------- postgres
# The throwaway database always lives on $DB_PORT. The launcher passes its URL
# explicitly to migrations, the seed and the API (below), so whatever
# apps/backend/.env names — a Supabase pooler, a teammate's tunnel, or the
# developer's own local database — is never touched.

if docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1; then
  [ "$(container_label "$POSTGRES_CONTAINER")" = "1" ] ||
    die "container $POSTGRES_CONTAINER exists but was not created by this skill; refusing to touch it."
  docker start "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
  say "  ✓ reusing postgres container"
else
  if port_busy "$DB_PORT"; then
    owner=$(port_pid "$DB_PORT" || true)
    die "port $DB_PORT is already in use${owner:+ (pid $owner)}. That is someone's Supabase pooler or tunnel — never drive someone else's database."
  fi
  docker run -d --name "$POSTGRES_CONTAINER" --label "$LABEL" \
    -p "$DB_PORT:5432" \
    -e POSTGRES_HOST_AUTH_METHOD=trust \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_DB="$DB_NAME" \
    postgres:17 >/dev/null || die "could not start the postgres container"
  say "  ✓ started postgres container (fresh database)"
fi
wait_until "postgres accepts connections" 60 \
  docker exec "$POSTGRES_CONTAINER" pg_isready -q -U postgres ||
  die "postgres did not become ready."

if db_seeded; then
  say "  ✓ schema and seed data present"
else
  say "  … applying migrations (log: $LOGS/db-migrate.log)"
  (cd "$REPO" && env DATABASE_URL="$DATABASE_URL" pnpm --filter backend db:migrate >"$LOGS/db-migrate.log" 2>&1) ||
    die "db:migrate failed — see $LOGS/db-migrate.log"
  # The demo-listings seed only runs for an `admin`-role account; the bootstrap
  # admin is `super_admin`, so seed that second role first.
  docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$DB_NAME" -q -c \
    "insert into users (username, role, status) values ('verify-seed-admin','admin','active') on conflict do nothing;" \
    >/dev/null ||
    die "could not create the listings-seed admin fixture"
  say "  … seeding categories, geography, demo listings (log: $LOGS/db-seed.log)"
  # Photo seeding uploads real objects to the shared Supabase bucket configured
  # in apps/backend/.env. Empty values win over .env (dotenv never overrides)
  # so a fresh run does not add objects there unless explicitly opted in.
  seed_env=()
  if [ "${VERIFY_SEED_PHOTOS:-0}" != "1" ]; then
    seed_env=(SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY=)
  fi
  (cd "$REPO" && env DATABASE_URL="$DATABASE_URL" "${seed_env[@]}" ADMIN_SEED_PASSWORD="$ADMIN_PASSWORD" \
    pnpm --filter backend db:seed >"$LOGS/db-seed.log" 2>&1) ||
    die "db:seed failed — see $LOGS/db-seed.log"
  db_seeded || die "seed finished but no categories were written"
  say "  ✓ schema and seed data ready"
fi

# --------------------------------------------------------------------- backend

if port_owned_by_us "$BACKEND_PORT" "$BACKEND_PID_FILE" && backend_healthy; then
  say "  ✓ backend already healthy on :$BACKEND_PORT"
else
  owner=$(port_pid "$BACKEND_PORT" || true)
  if [ -n "$owner" ] && ! port_owned_by_us "$BACKEND_PORT" "$BACKEND_PID_FILE"; then
    die "port $BACKEND_PORT is owned by pid $owner, which this skill did not start. Run scripts/cleanup.sh or stop it first."
  fi
  rm -f "$BACKEND_PID_FILE"
  say "  … starting backend (log: $LOGS/backend.log)"
  (
    cd "$REPO"
    setsid env DEV_OTP_TOKEN="$DEV_OTP_TOKEN" DATABASE_URL="$DATABASE_URL" \
      QUEUE_HOST=localhost QUEUE_PORT="$REDIS_PORT" \
      pnpm --filter backend dev >"$LOGS/backend.log" 2>&1 &
    echo $! >"$BACKEND_PID_FILE"
  )
  wait_until "backend /health reports db:up" 240 backend_healthy ||
    die "backend never became healthy — see $LOGS/backend.log"
fi

# ------------------------------------------------------------------------- web
# `next dev` (Turbopack) fails on this checkout: "couldn't find the Next.js
# package (next/package.json) from …/apps/web/app". The webpack dev server is
# the supported path here (see SKILL.md → Gotchas).

if port_owned_by_us "$WEB_PORT" "$WEB_PID_FILE" && web_healthy; then
  say "  ✓ web already serving on :$WEB_PORT"
else
  owner=$(port_pid "$WEB_PORT" || true)
  if [ -n "$owner" ] && ! port_owned_by_us "$WEB_PORT" "$WEB_PID_FILE"; then
    die "port $WEB_PORT is owned by pid $owner, which this skill did not start. Run scripts/cleanup.sh, stop it, or set VERIFY_WEB_PORT to a free port."
  fi
  rm -f "$WEB_PID_FILE"
  # A dev server that was killed mid-compile leaves a half-written .next/dev and
  # every page then 500s with ENOENT routes-manifest.json. Start from clean.
  rm -rf "$REPO/apps/web/.next/dev"
  say "  … starting web (log: $LOGS/web.log)"
  (
    cd "$REPO/apps/web"
    setsid ./node_modules/.bin/next dev --webpack -p "$WEB_PORT" >"$LOGS/web.log" 2>&1 &
    echo $! >"$WEB_PID_FILE"
  )
  wait_until "web serves /en with HTTP 200" 240 web_healthy ||
    die "web never served /en — see $LOGS/web.log"
fi

{
  printf 'REPO=%s\n' "$REPO"
  printf 'STARTED_AT=%s\n' "$(date -Is)"
  printf 'DATABASE_URL=%s\n' "$DATABASE_URL"
  printf 'REDIS_PORT=%s\n' "$REDIS_PORT"
  printf 'WEB_PORT=%s\n' "$WEB_PORT"
  printf 'BACKEND_PORT=%s\n' "$BACKEND_PORT"
} >"$META_FILE"

say ""
say "Ready."
say "  web           http://localhost:$WEB_PORT/en"
say "  admin         http://localhost:$WEB_PORT/wanderer/login"
say "  backend       http://localhost:$BACKEND_PORT/api/v1  (docs: /api/docs)"
say "  database      $DATABASE_URL (throwaway container)"
say "  redis         localhost:$REDIS_PORT (verify container, passed as QUEUE_PORT)"
say "  otp bypass    $DEV_OTP_TOKEN"
say "  admin login   admin / $ADMIN_PASSWORD"
say "  logs          $LOGS"
say "Next: .cursor/skills/verify-phsarkhmer/scripts/doctor.sh, then drive a feature with .cursor/skills/verify-phsarkhmer/scripts/cdp.mjs."
