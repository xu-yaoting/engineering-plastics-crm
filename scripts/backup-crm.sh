#!/bin/bash
set -euo pipefail

ROOT_DIR="${CRM_ROOT_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"}"
DB_PATH="$ROOT_DIR/crm.db"
BACKUP_DIR="$ROOT_DIR/backups"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
BACKUP_TAR="$BACKUP_DIR/crm-$TIMESTAMP.tar.gz"
CHECKSUM_FILE="$BACKUP_TAR.sha256"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required to create a consistent CRM backup." >&2
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "CRM database not found: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# Create consistent database snapshot
STAGING_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGING_DIR"' EXIT
sqlite3 "$DB_PATH" ".backup '$STAGING_DIR/crm.db'"

# Include materials-tooling attachments if present
ATTACHMENTS_SRC="$ROOT_DIR/data/materials-tooling"
if [ -d "$ATTACHMENTS_SRC" ]; then
  mkdir -p "$STAGING_DIR/data"
  cp -r "$ATTACHMENTS_SRC" "$STAGING_DIR/data/materials-tooling"
fi

# Create tar archive
(cd "$STAGING_DIR" && tar -czf "$BACKUP_TAR" .)
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$BACKUP_TAR" > "$CHECKSUM_FILE"
else
  shasum -a 256 "$BACKUP_TAR" > "$CHECKSUM_FILE"
fi

echo "CRM backup created:"
echo "$BACKUP_TAR"
echo "Checksum:"
echo "$CHECKSUM_FILE"
