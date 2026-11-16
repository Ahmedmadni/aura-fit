#!/usr/bin/env bash
# Retry ONLY transient dependency repository failures. Compilation, signing,
# integrity or configuration errors fail immediately. Never bypass checks.
set -euo pipefail
if [ "$#" -lt 1 ]; then
  echo "Usage: bash scripts/gradle-retry-429.sh <gradle-tasks...>" >&2
  exit 2
fi
for attempt in 1 2 3; do
  LOG=$(mktemp)
  if (cd android-offline && gradle --no-daemon "$@" > "$LOG" 2>&1); then
    cat "$LOG"
    rm -f "$LOG"
    exit 0
  fi
  echo "Gradle attempt $attempt failed (log tail):" >&2
  tail -65 "$LOG" >&2
  if grep -Eiq 'Received status code 429|Too Many Requests|HTTP 429|Read timed out|Received status code 503|Received status code 502' "$LOG" &&
    [ "$attempt" -lt 3 ]; then
    rm -f "$LOG"
    SECONDS_TO_WAIT=$((attempt * 45))
    echo "Transient Maven artifact repository error. Retrying after ${SECONDS_TO_WAIT}s..." >&2
    sleep "$SECONDS_TO_WAIT"
  else
    rm -f "$LOG"
    echo "Gradle build failed; refusing to bypass repository, code or signing checks." >&2
    exit 1
  fi
done
exit 1
