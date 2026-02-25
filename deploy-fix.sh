#!/usr/bin/env bash
# deploy-fix.sh — force-sync VPS to claude/add-deployment-docs-siqIV and rebuild frontend
set -euo pipefail

BRANCH="claude/add-deployment-docs-siqIV"
COMPOSE_DIR="/docker/exfsafegrid"

echo "=== [1/5] Navigating to project root ==="
cd "$COMPOSE_DIR"
echo "CWD: $(pwd)"

echo ""
echo "=== [2/5] Fetching latest branch from origin ==="
git fetch origin "$BRANCH"

echo ""
echo "=== [3/5] Force-switching to $BRANCH (discards any local drift) ==="
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo ""
echo "=== [4/5] Verifying critical files ==="
echo -n "  nginx.conf resolver: "
if grep -q "resolver 127.0.0.11" nginx.conf; then
  echo "OK"
else
  echo "MISSING — aborting" && exit 1
fi

echo -n "  Dockerfile.frontend curl: "
if grep -q "apk add --no-cache curl" Dockerfile.frontend; then
  echo "OK"
else
  echo "MISSING — aborting" && exit 1
fi

echo ""
echo "=== [5/5] Rebuilding and restarting frontend (no cache) ==="
docker compose build --no-cache frontend
docker compose up -d frontend

echo ""
echo "=== Waiting 45s for healthcheck to run... ==="
sleep 45

echo ""
echo "=== Health log ==="
docker inspect exf_frontend --format='{{json .State.Health.Log}}' | python3 -m json.tool

echo ""
echo "=== Container status ==="
docker compose ps frontend
