#!/usr/bin/env sh
# Restores the newest backup into a disposable database in the same PostgreSQL cluster.
set -eu

: "${POSTGRES_CONTAINER:?POSTGRES_CONTAINER is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DATABASE:?POSTGRES_DATABASE is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${RESTORE_TEST_DATABASE:?RESTORE_TEST_DATABASE is required}"

case "$RESTORE_TEST_DATABASE" in
  neoprospector_restore_verify*) ;;
  *) echo 'RESTORE_TEST_DATABASE must start with neoprospector_restore_verify' >&2; exit 1 ;;
esac

archive=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'neoprospector-*.dump' -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)
test -n "$archive"
sha256sum -c "$archive.sha256"

container_archive="/tmp/$(basename "$archive")"
cleanup() {
  docker exec "$POSTGRES_CONTAINER" dropdb -U "$POSTGRES_USER" --if-exists "$RESTORE_TEST_DATABASE" >/dev/null 2>&1 || true
  docker exec "$POSTGRES_CONTAINER" rm -f "$container_archive" >/dev/null 2>&1 || true
}
trap cleanup EXIT HUP INT TERM

docker exec "$POSTGRES_CONTAINER" dropdb -U "$POSTGRES_USER" --if-exists "$RESTORE_TEST_DATABASE"
docker exec "$POSTGRES_CONTAINER" createdb -U "$POSTGRES_USER" "$RESTORE_TEST_DATABASE"
docker cp "$archive" "$POSTGRES_CONTAINER:$container_archive"
docker exec "$POSTGRES_CONTAINER" pg_restore -U "$POSTGRES_USER" -d "$RESTORE_TEST_DATABASE" --no-owner --no-privileges "$container_archive"

tables=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$RESTORE_TEST_DATABASE" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'scraping_jobs', 'leads', 'system_state')")
marker=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$RESTORE_TEST_DATABASE" -Atc "SELECT count(*) FROM \"system_state\" WHERE \"key\" = 'primary'")
test "$tables" = '4'
test "$marker" = '1'
printf '%s Backup restoration verified: %s\n' "$(date -u +%FT%TZ)" "$archive"
