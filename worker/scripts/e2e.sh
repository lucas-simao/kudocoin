#!/usr/bin/env bash
# Runs inside `firebase emulators:exec` (see firebase/package.json): starts the Worker against the
# emulators, waits for it, runs the end-to-end tests, and stops it.
set -euo pipefail
cd "$(dirname "$0")/.."
export WRANGLER_SEND_METRICS=false
npx wrangler dev --env dev --test-scheduled --port 18611 --ip 127.0.0.1 > /tmp/kudocoin-worker.log 2>&1 &
worker=$!
trap 'kill $worker 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:18611/api/health > /dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:18611/api/health > /dev/null || { cat /tmp/kudocoin-worker.log; exit 1; }
status=0
npx vitest run --config vitest.e2e.config.ts || status=$?
[ "$status" = 0 ] || tail -50 /tmp/kudocoin-worker.log
exit $status
