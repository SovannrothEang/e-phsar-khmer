#!/usr/bin/env bash
# Tear down the stack this skill started. Removes instances and scratch state;
# never removes proof artifacts. Safe to re-run, and it never kills a process or
# container that this skill did not create.
set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$SCRIPT_DIR/../../../.." && pwd)
RUN_DIR=${VERIFY_RUN_DIR:-/tmp/opencode/verify-phsarkhmer}
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"
META_FILE="$RUN_DIR/meta"
LABEL=verify.phsarkhmer=1
ARTIFACTS="$REPO/.cursor/skills/verify-phsarkhmer/artifacts"

say() { printf '%s\n' "$*"; }

pid_belongs_to_repo() { # pid
  local pid=$1 cwd args
  args=$(ps -p "$pid" -o args= 2>/dev/null || true)
  case "$args" in
    *"$REPO"*) return 0 ;;
  esac
  # `pnpm --filter backend dev` and `next dev` do not put the checkout path on
  # their command line, so fall back to their working directory.
  cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null || true)
  case "$cwd" in
    "$REPO" | "$REPO"/*) return 0 ;;
  esac
  return 1
}

stop_group() { # label, pid-file
  local label=$1 file=$2 pid sid
  [ -f "$file" ] || {
    say "  · $label: nothing to stop"
    return
  }
  pid=$(cat "$file")
  if ! kill -0 "$pid" 2>/dev/null; then
    say "  · $label: pid $pid already gone"
    rm -f "$file"
    return
  fi
  if ! pid_belongs_to_repo "$pid"; then
    say "  ! $label: pid $pid does not belong to $REPO — leaving it alone"
    rm -f "$file"
    return
  fi
  sid=$(ps -o sid= -p "$pid" 2>/dev/null | tr -d ' ')
  if [ "$sid" != "$pid" ]; then
    say "  ! $label: pid $pid is not a launch session leader — leaving it alone"
    rm -f "$file"
    return
  fi
  # The launcher used setsid, so every process the stack spawned — nest's
  # compiler child, its detached app, next's server — shares this session id.
  pkill -TERM -s "$sid" 2>/dev/null || true
  for _ in $(seq 1 20); do
    pgrep -s "$sid" >/dev/null 2>&1 || break
    sleep 0.5
  done
  pkill -KILL -s "$sid" 2>/dev/null || true
  rm -f "$file"
  say "  ✓ stopped $label (session $sid)"
}

say "Cleaning up PSA verification stack"

stop_group backend "$BACKEND_PID_FILE"
stop_group web "$WEB_PID_FILE"

for container in $(docker ps -aq --filter "label=$LABEL" 2>/dev/null); do
  docker rm -f -v "$container" >/dev/null 2>&1 &&
    say "  ✓ removed container $container (with its volume)"
done

if [ -f "$RUN_DIR/cdp-state.json" ]; then
  node "$SCRIPT_DIR/cdp.mjs" close | sed 's/^/  ✓ /'
fi

rm -f "$META_FILE" "$RUN_DIR/cdp-state.json"
say ""
say "Proof artifacts are kept at: $ARTIFACTS"
