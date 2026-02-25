#!/usr/bin/env bash
# deploy-fix.sh — force-sync VPS to claude/add-deployment-docs-siqIV and rebuild frontend
set -euo pipefail

BRANCH="claude/add-deployment-docs-siqIV"
COMPOSE_DIR="/docker/exfsafegrid"

echo "=== [1/6] Navigating to project root ==="
cd "$COMPOSE_DIR"
echo "CWD: $(pwd)"

echo ""
echo "=== [2/6] Fetching latest branch from origin ==="
git fetch origin "$BRANCH"

echo ""
echo "=== [3/6] Stashing local changes, then force-switching to $BRANCH ==="
git stash push -m "vps-local-before-deploy-fix" -- config/settings.py docker-compose.yml || true
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo ""
echo "=== [4/6] Re-applying production port override (8080:80) ==="
# The VPS exposes the frontend on host port 8080, not 80.
# Branch ships with 80:80; we patch it back to the production value.
sed -i 's/- "80:80"/- "8080:80"/' docker-compose.yml
echo "  docker-compose.yml frontend port: $(grep '808.*:80' docker-compose.yml | tr -d ' ')"

echo ""
echo "=== [5/6] Verifying critical files ==="
echo -n "  nginx.conf resolver:        "
if grep -q "resolver 127.0.0.11" nginx.conf; then
  echo "OK"
else
  echo "MISSING — aborting" && exit 1
fi

echo -n "  Dockerfile.frontend curl:   "
if grep -q "apk add --no-cache curl" Dockerfile.frontend; then
  echo "OK"
else
  echo "MISSING — aborting" && exit 1
fi

echo -n "  docker-compose.yml port:    "
if grep -q '"8080:80"' docker-compose.yml; then
  echo "OK (8080:80)"
else
  echo "UNEXPECTED — aborting" && exit 1
fi

echo ""
echo "=== [6/6] Rebuilding and restarting frontend (no cache) ==="
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
