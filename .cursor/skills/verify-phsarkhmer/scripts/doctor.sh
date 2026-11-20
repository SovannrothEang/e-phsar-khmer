#!/usr/bin/env bash
# Read-only health check: "is this instance worth driving?"
# Never starts, stops or repairs anything. Exit 0 = safe to drive.
set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$SCRIPT_DIR/../../../.." && pwd)
RUN_DIR=${VERIFY_RUN_DIR:-/tmp/opencode/verify-phsarkhmer}
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"
META_FILE="$RUN_DIR/meta"
STATE_FILE="$RUN_DIR/cdp-state.json"
BACKEND_PORT=8080
WEB_PORT=3001
REDIS_CONTAINER=psa-verify-redis
POSTGRES_CONTAINER=psa-verify-postgres
# Database name inside the throwaway container. The launcher passes its URL to
# the API and migrations; apps/backend/.env's DATABASE_URL is never used.
DB_NAME=phsar_db

port_pid() { # prints the pid listening on a TCP port, if it is ours to see
  ss -ltnpH "sport = :$1" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | head -1
}

session_owns_port() { # port, pid-file -> 0 yes, 1 no, 2 cannot tell
  local port=$1 file=$2 pid owner owner_sid
  [ -f "$file" ] || return 1
  pid=$(cat "$file")
  owner=$(port_pid "$port")
  [ -n "$owner" ] || return 2
  owner_sid=$(ps -o sid= -p "$owner" 2>/dev/null | tr -d ' ')
  [ "$owner_sid" = "$pid" ]
}

failures=0
ok() { printf 'OK   %s\n' "$*"; }
bad() {
  printf 'FAIL %s\n' "$*"
  failures=$((failures + 1))
}
info() { printf 'INFO %s\n' "$*"; }

[ -f "$META_FILE" ] ||
  bad "no launch record at $META_FILE — run scripts/launch.sh first"
if [ -f "$META_FILE" ]; then
  # shellcheck disable=SC1090
  . "$META_FILE"
  info "launched $STARTED_AT from $REPO"
fi

repo_head=$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo unknown)
info "commit $repo_head · node $(node -v) · pnpm $(pnpm -v 2>/dev/null || echo '?')"
info "web $(cd "$REPO/apps/web" && node -p "require('./package.json').dependencies.next" 2>/dev/null || echo '?')"

# --------------------------------------------------------------- app processes

if [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
  ok "backend process alive (pid $(cat "$BACKEND_PID_FILE"))"
  session_owns_port "$BACKEND_PORT" "$BACKEND_PID_FILE"
  case $? in
    0) ok "port :$BACKEND_PORT is owned by the launch session" ;;
    2) info "cannot see which process owns :$BACKEND_PORT (ownership unchecked)" ;;
    *) bad "port :$BACKEND_PORT is owned by a process outside the launch session — a stray watcher may be serving stale config" ;;
  esac
else
  bad "backend process is not running (no live pid in $BACKEND_PID_FILE)"
fi

if [ -f "$WEB_PID_FILE" ] && kill -0 "$(cat "$WEB_PID_FILE")" 2>/dev/null; then
  ok "web process alive (pid $(cat "$WEB_PID_FILE"))"
  session_owns_port "$WEB_PORT" "$WEB_PID_FILE"
  case $? in
    0) ok "port :$WEB_PORT is owned by the launch session" ;;
    2) info "cannot see which process owns :$WEB_PORT (ownership unchecked)" ;;
    *) bad "port :$WEB_PORT is owned by a process outside the launch session" ;;
  esac
else
  bad "web process is not running (no live pid in $WEB_PID_FILE)"
fi

# ------------------------------------------------------------------- backend

health=$(curl -fsS -m 5 "http://localhost:$BACKEND_PORT/health" 2>/dev/null || true)
case "$health" in
  *'"db":"up"'*) ok "backend /health is ok and reports db:up" ;;
  *) bad "backend /health missing or db is not up (http://localhost:$BACKEND_PORT/health)" ;;
esac

categories=$(curl -fsS -m 10 "http://localhost:$BACKEND_PORT/api/v1/categories" 2>/dev/null || true)
case "$categories" in
  *'"success":true'*) ok "backend /api/v1/categories answers (data path through Postgres works)" ;;
  *) bad "backend /api/v1/categories did not return success — check $RUN_DIR/logs/backend.log" ;;
esac

# ----------------------------------------------------------------------- web

web_code=$(curl -s -o /dev/null -m 90 -w '%{http_code}' "http://localhost:$WEB_PORT/en" 2>/dev/null)
# A 200 is not enough: a dev server with a half-written .next/dev answers 200 on
# some routes and "Internal Server Error" with an empty title on others.
web_html=$(curl -s -m 90 "http://localhost:$WEB_PORT/en" 2>/dev/null || true)
case "$web_html" in
  *PhsarKhmer*) ok "web renders /en (HTTP 200, app shell present)" ;;
  *) bad "web /en returned HTTP $web_code without the app shell — check $RUN_DIR/logs/web.log" ;;
esac

# ------------------------------------------------------------------- containers

if [ "$(docker inspect -f '{{.State.Running}}' "$REDIS_CONTAINER" 2>/dev/null)" = "true" ] &&
  [ "$(docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null)" = "PONG" ]; then
  ok "redis container $REDIS_CONTAINER is up and answers PING"
else
  bad "redis container $REDIS_CONTAINER is not usable (BullMQ queues need it)"
fi

if [ "$(docker inspect -f '{{.State.Running}}' "$POSTGRES_CONTAINER" 2>/dev/null)" = "true" ] &&
  docker exec "$POSTGRES_CONTAINER" pg_isready -q -U postgres 2>/dev/null; then
  listings=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$DB_NAME" -tAc \
    "select count(*) from listings" 2>/dev/null | tr -d '[:space:]')
  categories_count=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$DB_NAME" -tAc \
    "select count(*) from categories" 2>/dev/null | tr -d '[:space:]')
  if [ -n "$categories_count" ] && [ "$categories_count" -gt 0 ]; then
    ok "postgres container is up ($categories_count categories, ${listings:-0} listings)"
    if [ "${listings:-0}" -eq 0 ]; then
      info "no listings seeded — browse/search journeys will only show empty states"
    fi
    published_db_port=$(docker port "$POSTGRES_CONTAINER" 5432/tcp 2>/dev/null |
      head -1 | sed -n 's/.*:\([0-9][0-9]*\)$/\1/p')
    if [ -n "${DATABASE_URL:-}" ] && [ -n "$published_db_port" ]; then
      case "$DATABASE_URL" in
        *":$published_db_port/"*)
          ok "launch record points the API and migrations at the throwaway database (:$published_db_port)"
          ;;
        *)
          bad "launch record's DATABASE_URL is not the throwaway database on :$published_db_port — the run may be writing elsewhere"
          ;;
      esac
    else
      info "launch record has no DATABASE_URL (older run); database target unchecked"
    fi
  else
    bad "postgres is up but the schema/seed is missing — rerun scripts/launch.sh"
  fi
else
  bad "postgres container $POSTGRES_CONTAINER is not usable"
fi

if [ -n "${REDIS_PORT:-}" ]; then
  info "dedicated verify redis is on :$REDIS_PORT (API receives it as QUEUE_PORT)"
fi

# ------------------------------------------------------------------ browser

if [ -f "$STATE_FILE" ] && node -e '
  const fs = require("node:fs");
  const s = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  fetch(`http://127.0.0.1:${s.port}/json/version`)
    .then((r) => process.exit(r.ok ? 0 : 1))
    .catch(() => process.exit(1));
' "$STATE_FILE" 2>/dev/null; then
  ok "headless chromium is reachable for CDP driving"
else
  info "headless chromium not running (scripts/cdp.mjs open <url> starts it)"
fi

printf '\n'
if [ "$failures" -gt 0 ]; then
  printf 'VERDICT: %d check(s) failed — do not trust this instance.\n' "$failures"
  exit 1
fi
printf 'VERDICT: instance is healthy; safe to drive.\n'
