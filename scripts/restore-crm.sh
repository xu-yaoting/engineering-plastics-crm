#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="$ROOT_DIR/crm.db"
BACKUP_SCRIPT="$ROOT_DIR/scripts/backup-crm.sh"

usage() {
  echo "Usage: $0 --confirm /path/to/crm-backup.db.gz"
  echo ""
  echo "This replaces the current local CRM database."
  echo "Close the CRM app before restoring."
}

if [ "${1:-}" != "--confirm" ] || [ -z "${2:-}" ]; then
  usage
  exit 1
fi

BACKUP_FILE="$2"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if [ -f "$DB_PATH" ]; then
  echo "Creating pre-restore backup..."
  "$BACKUP_SCRIPT" >/dev/null
fi

rm -f "$DB_PATH" "$ROOT_DIR/crm.db-wal" "$ROOT_DIR/crm.db-shm"

case "$BACKUP_FILE" in
  *.gz)
    gunzip -c "$BACKUP_FILE" > "$DB_PATH"
    ;;
  *)
    cp "$BACKUP_FILE" "$DB_PATH"
    ;;
esac

echo "CRM database restored from:"
echo "$BACKUP_FILE"
echo "Start the CRM again with ./start-crm.sh"
