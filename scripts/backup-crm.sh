#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="$ROOT_DIR/crm.db"
BACKUP_DIR="$ROOT_DIR/backups"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
BACKUP_DB="$BACKUP_DIR/crm-$TIMESTAMP.db"
BACKUP_GZ="$BACKUP_DB.gz"
CHECKSUM_FILE="$BACKUP_GZ.sha256"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required to create a consistent CRM backup." >&2
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "CRM database not found: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

sqlite3 "$DB_PATH" ".backup '$BACKUP_DB'"
gzip -f "$BACKUP_DB"
shasum -a 256 "$BACKUP_GZ" > "$CHECKSUM_FILE"

echo "CRM backup created:"
echo "$BACKUP_GZ"
echo "Checksum:"
echo "$CHECKSUM_FILE"
