#!/bin/bash
set -euo pipefail

ROOT_DIR="${CRM_ROOT_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"}"
DB_PATH="$ROOT_DIR/crm.db"
BACKUP_SCRIPT="$ROOT_DIR/scripts/backup-crm.sh"

usage() {
  echo "Usage: $0 --confirm /path/to/crm-backup.tar.gz"
  echo ""
  echo "Restores the CRM database and attachments from a backup."
  echo "Accepts .tar.gz (new format) and .db.gz / .db (legacy) files."
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

STAGING_DIR="$(mktemp -d)"
STAGED_DB="$STAGING_DIR/crm.db"
STAGED_ATTACHMENTS="$STAGING_DIR/data/materials-tooling"
RESTORE_ATTACHMENTS=""
cleanup() {
  rm -rf "$STAGING_DIR"
  if [ -n "$RESTORE_ATTACHMENTS" ]; then rm -rf "$RESTORE_ATTACHMENTS"; fi
}
trap cleanup EXIT

CHECKSUM_FILE="$BACKUP_FILE.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
  EXPECTED_CHECKSUM="$(awk 'NR == 1 { print $1 }' "$CHECKSUM_FILE")"
  ACTUAL_CHECKSUM="$(shasum -a 256 "$BACKUP_FILE" | awk '{ print $1 }')"
  if [ -z "$EXPECTED_CHECKSUM" ] || [ "$EXPECTED_CHECKSUM" != "$ACTUAL_CHECKSUM" ]; then
    echo "Backup checksum verification failed: $BACKUP_FILE" >&2
    exit 1
  fi
fi

case "$BACKUP_FILE" in
  *.tar.gz)
    if ! tar -xzf "$BACKUP_FILE" -C "$STAGING_DIR"; then
      echo "Backup archive cannot be read: $BACKUP_FILE" >&2
      exit 1
    fi
    if [ ! -f "$STAGED_DB" ]; then
      echo "Backup archive does not contain crm.db" >&2
      exit 1
    fi
    ;;
  *.db.gz)
    if ! gunzip -c "$BACKUP_FILE" > "$STAGED_DB"; then
      echo "Legacy database backup cannot be read: $BACKUP_FILE" >&2
      exit 1
    fi
    ;;
  *.db)
    cp "$BACKUP_FILE" "$STAGED_DB"
    ;;
  *)
    echo "Unsupported backup format: $BACKUP_FILE" >&2
    echo "Supported: .tar.gz (new), .db.gz or .db (legacy)" >&2
    exit 1
    ;;
esac

if ! QUICK_CHECK="$(sqlite3 "$STAGED_DB" "PRAGMA quick_check;")" || [ "$QUICK_CHECK" != "ok" ]; then
  echo "Backup does not contain a valid SQLite database: $BACKUP_FILE" >&2
  exit 1
fi

if [ -f "$DB_PATH" ]; then
  echo "Creating pre-restore backup..."
  "$BACKUP_SCRIPT" >/dev/null
fi

mkdir -p "$ROOT_DIR"
RESTORE_DB="$ROOT_DIR/.crm.db.restore.$$"
cp "$STAGED_DB" "$RESTORE_DB"

if [[ "$BACKUP_FILE" == *.tar.gz ]]; then
  mkdir -p "$ROOT_DIR/data"
  if [ -d "$STAGED_ATTACHMENTS" ]; then
    RESTORE_ATTACHMENTS="$ROOT_DIR/data/.materials-tooling.restore.$$"
    cp -R "$STAGED_ATTACHMENTS" "$RESTORE_ATTACHMENTS"
  fi
fi

rm -f "$ROOT_DIR/crm.db-wal" "$ROOT_DIR/crm.db-shm"
mv -f "$RESTORE_DB" "$DB_PATH"

if [[ "$BACKUP_FILE" == *.tar.gz ]]; then
  rm -rf "$ROOT_DIR/data/materials-tooling"
  if [ -n "$RESTORE_ATTACHMENTS" ]; then
    mv "$RESTORE_ATTACHMENTS" "$ROOT_DIR/data/materials-tooling"
    RESTORE_ATTACHMENTS=""
  fi
fi

echo "CRM database restored from:"
echo "$BACKUP_FILE"
echo "Start the CRM again with ./start-crm.sh"
