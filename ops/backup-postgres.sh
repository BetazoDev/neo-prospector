#!/usr/bin/env sh
# Run from the Linux Docker host after sourcing /etc/neoprospector-backup.env.
set -eu

: "${POSTGRES_CONTAINER:?POSTGRES_CONTAINER is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DATABASE:?POSTGRES_DATABASE is required}"
: "${POSTGRES_CLIENT_IMAGE:?POSTGRES_CLIENT_IMAGE is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${KEEP_DAYS:=30}"

umask 077
mkdir -p "$BACKUP_DIR"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
archive="$BACKUP_DIR/neoprospector-$timestamp.dump"
temporary="$archive.partial"

cleanup() { rm -f "$temporary"; }
trap cleanup EXIT HUP INT TERM

docker exec "$POSTGRES_CONTAINER" pg_dump \
  -U "$POSTGRES_USER" \
  --format=custom \
  --no-owner \
  --no-privileges \
  "$POSTGRES_DATABASE" > "$temporary"

test -s "$temporary"
docker run --rm \
  -v "$BACKUP_DIR:/backups:ro" \
  "$POSTGRES_CLIENT_IMAGE" \
  pg_restore --list "/backups/$(basename "$temporary")" >/dev/null

mv "$temporary" "$archive"
sha256sum "$archive" > "$archive.sha256"
find "$BACKUP_DIR" -type f \( -name 'neoprospector-*.dump' -o -name 'neoprospector-*.dump.sha256' \) -mtime "+$KEEP_DAYS" -delete
trap - EXIT HUP INT TERM
printf '%s Backup created: %s\n' "$(date -u +%FT%TZ)" "$archive"
