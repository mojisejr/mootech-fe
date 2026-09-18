#!/usr/bin/env bash
# container-smoke.sh — build the mootech-fe image from THIS revision and prove, on the built image (standalone
# `node server.js`, not `next dev`), what mumate-infra-move-001 slice 1 asks of it:
#
#   1. hygiene      no .env of any spelling inside the image; no credential-shaped string in the layer history;
#                   runs as node; the VAPID placeholder tracer is absent from the client bundle
#   2. readiness    with a real database, GET /api/health → 200 {db:"ok", sha}; GET / renders (200)
#   3. maintenance  the SAME image with MAINTENANCE_MODE=on: "/" is rewritten to the maintenance page, /api/health
#                   and /api/auth/csrf stay allow-listed, /api/cron/* reaches the route (401 without CRON_SECRET,
#                   not the 200 maintenance HTML), ?bypass=<key> redirects and sets the mnt_bypass cookie
#
# Usage:
#   bash scripts/container-smoke.sh            # all; DB env from $SMOKE_ENV_FILE (see below)
#   bash scripts/container-smoke.sh --no-db    # 1 only (CI without a database)
#
# SMOKE_ENV_FILE  env file for 2-3. Default: the arena's committed local env, testenv/env/fe.env (dummy secrets,
#                 docker Postgres on :5433). `localhost` → host.docker.internal so the container reaches the host.
#                 Never point this at production.
# SMOKE_PORT      host port to publish (default 3001; 3002 for the maintenance container).
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"; cd "$HERE"
SHA="$(git rev-parse HEAD)"; TAG="mootech-fe:smoke-${SHA:0:12}"
NO_DB=0; [ "${1:-}" = "--no-db" ] && NO_DB=1
PORT="${SMOKE_PORT:-3001}"; MPORT=$((PORT+1)); CNAME="mootech-fe-smoke-$$"; MNAME="${CNAME}-mnt"
fail() { echo "❌ $*" >&2; exit 1; }
cleanup() { docker rm -f "$CNAME" "$MNAME" >/dev/null 2>&1 || true; rm -f "${ENV_TMP:-}"; }
trap cleanup EXIT

echo "── build ${TAG} (APP_GIT_SHA=${SHA:0:12}) ──"
# Public build-time values only. NEXT_PUBLIC_OMISE_KEY_V2 is a test-shaped placeholder so the repo's postbuild
# gate check-omise-key-inlined.sh runs its PRESENT check against the real artifact instead of skipping.
docker build --build-arg "APP_GIT_SHA=${SHA}" \
  --build-arg NEXTAUTH_URL=http://localhost:${PORT} \
  --build-arg NEXT_PUBLIC_BACKEND_URL=http://host.docker.internal:4000 \
  --build-arg NEXT_PUBLIC_OMISE_KEY_V2=pkey_test_containersmoke_placeholder \
  -t "$TAG" . | tail -3

echo "── 1. hygiene ──"
envs=$(docker run --rm --entrypoint sh "$TAG" -c 'find /app -maxdepth 2 \( -name ".env" -o -name ".env.*" -o -name "*.testenv-shadowed" \) 2>/dev/null' || true)
[ -z "$envs" ] || fail "env file(s) inside the image: $envs"
if docker history --no-trunc "$TAG" | grep -Eiq 'SECRET=[^$ ]|postgres(ql)?://[^ ]*:[^ ]*@|DATABASE_URL='; then
  fail "credential-shaped string in image history"
fi
who=$(docker run --rm --entrypoint id "$TAG" -un); [ "$who" = "node" ] || fail "runs as $who, expected node"
if docker run --rm --entrypoint sh "$TAG" -c 'grep -rqF vapid_private_placeholder_do_not_use /app/.next/static' 2>/dev/null; then
  fail "VAPID placeholder tracer found in the client bundle inside the image"
fi
echo "   ✅ no env files, clean history, runs as node, VAPID tracer absent from the bundle"

if [ "$NO_DB" = 1 ]; then echo "── 2-3 SKIPPED (--no-db) — NOT CHECKED ──"; exit 0; fi

ENV_SRC="${SMOKE_ENV_FILE:-$HERE/testenv/env/fe.env}"
[ -f "$ENV_SRC" ] || fail "SMOKE_ENV_FILE not found: $ENV_SRC"
grep -Eq '^DATABASE_URL=postgres(ql)?://[^@]*@(localhost|127\.0\.0\.1|host\.docker\.internal):' "$ENV_SRC" || fail "refusing: $ENV_SRC DATABASE_URL is not a local host"
ENV_TMP="$(mktemp)"
grep -v '^#' "$ENV_SRC" | grep . | grep -v '^NODE_ENV=' | sed 's/localhost/host.docker.internal/g' > "$ENV_TMP"

echo "── 2. readiness against a real database ──"
docker run -d --name "$CNAME" --env-file "$ENV_TMP" -p "${PORT}:3000" "$TAG" >/dev/null
for i in $(seq 1 45); do body=$(curl -fsS "http://127.0.0.1:${PORT}/api/health" 2>/dev/null) && break; sleep 2; done
[ -n "${body:-}" ] || { docker logs "$CNAME" | tail -20; curl -sS "http://127.0.0.1:${PORT}/api/health" || true; fail "/api/health never answered 200 within 90s"; }
echo "$body" | grep -q '"db":"ok"' || fail "db not ok: $body"
echo "$body" | grep -q "\"sha\":\"${SHA}\"" || fail "sha not reported: $body"
home=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/")
[ "$home" = "200" ] || fail "GET / answered $home"
echo "   ✅ /api/health → $body"
echo "   ✅ /           → $home"

echo "── 3. maintenance gate on the image ──"
docker run -d --name "$MNAME" --env-file "$ENV_TMP" -e MAINTENANCE_MODE=on -e MAINTENANCE_BYPASS_KEY=smokekey \
  -p "${MPORT}:3000" "$TAG" >/dev/null
for i in $(seq 1 45); do curl -fsS "http://127.0.0.1:${MPORT}/api/health" >/dev/null 2>&1 && break; sleep 2; done
curl -s "http://127.0.0.1:${MPORT}/" | grep -q 'ปิดปรับปรุงชั่วคราว' || fail "/ did not render the maintenance page under MAINTENANCE_MODE=on"
curl -fsS "http://127.0.0.1:${MPORT}/api/health" | grep -q '"db":"ok"' || fail "/api/health gated under maintenance"
curl -fsS "http://127.0.0.1:${MPORT}/api/auth/csrf" | grep -q '"csrfToken"' || fail "/api/auth/csrf did not return JSON under maintenance"
cron=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${MPORT}/api/cron/push-reminders")
[ "$cron" = "401" ] || fail "/api/cron/push-reminders answered $cron under maintenance (expected the route's own 401, not maintenance 200)"
hdr=$(curl -s -D - -o /dev/null "http://127.0.0.1:${MPORT}/?bypass=smokekey")
echo "$hdr" | grep -qi '^location:' || fail "?bypass did not redirect"
echo "$hdr" | grep -qi 'set-cookie: mnt_bypass=' || fail "?bypass did not set mnt_bypass"
echo "$hdr" | grep -qi '^location:.*bypass=' && fail "redirect Location still carries the bypass secret"
echo "   ✅ / → maintenance page · /api/health + /api/auth/csrf allow-listed · /api/cron/* → 401 · ?bypass → redirect + mnt_bypass cookie, secret stripped"
echo "✅ smoke passed for ${SHA}"
