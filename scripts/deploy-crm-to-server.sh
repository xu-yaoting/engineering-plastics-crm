#!/bin/bash
# Deploy JEKIN CRM from this Mac to the overseas server.
# Usage: bash scripts/deploy-crm-to-server.sh
# Env overrides: CRM_DEPLOY_HOST (default admin@47.82.158.162), CRM_DEPLOY_DIR (default /opt/jekin-crm)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${CRM_DEPLOY_HOST:-admin@47.82.158.162}"
DEST="${CRM_DEPLOY_DIR:-/opt/jekin-crm}"

cd "$ROOT"

echo "== 1/4 build (vite + tsc + fonts) =="
npm run build
test -f dist-server/fonts/NotoSansSC-Regular.ttf && test -f dist-server/fonts/NotoSansSC-Bold.ttf || { echo "❌ dist-server/fonts missing after build"; exit 1; }

echo "== 2/4 ensure remote directory =="
ssh "$HOST" "mkdir -p '$DEST'"

echo "== 3/4 rsync runtime artifacts -> $HOST:$DEST =="
rsync -az --delete dist/         "$HOST:$DEST/dist/"
rsync -az --delete dist-server/  "$HOST:$DEST/dist-server/"
rsync -az --delete scripts/      "$HOST:$DEST/scripts/"
rsync -az package.json package-lock.json "$HOST:$DEST/"

echo "== 4/4 install production deps on server =="
ssh "$HOST" "cd '$DEST' && npm ci --omit=dev"

echo ""
echo "✅ uploaded. To activate:"
echo "   ssh $HOST 'sudo systemctl restart jekin-crm'"
echo "   (first time: sudo systemctl enable --now jekin-crm)"
