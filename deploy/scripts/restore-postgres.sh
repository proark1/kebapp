#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

usage() {
  echo "Aufruf: $0 DUMP_DATEI ZIELDATENBANK --confirm ZIELDATENBANK" >&2
}

if [[ "$#" -ne 4 || "$3" != "--confirm" || "$2" != "$4" ]]; then
  usage
  exit 2
fi

DUMP_PATH="$1"
TARGET_DATABASE="$2"

if [[ ! "$TARGET_DATABASE" =~ ^kebapp_restore_[a-z0-9_]+$ ]]; then
  echo "Die Zieldatenbank muss mit kebapp_restore_ beginnen." >&2
  exit 1
fi

load_production_env
if [[ "$TARGET_DATABASE" == "$POSTGRES_DB" ]]; then
  echo "Eine Wiederherstellung in die Produktionsdatenbank ist gesperrt." >&2
  exit 1
fi

RELEASE_DIR="$(resolve_release_dir)"
BACKUP_ROOT="$(realpath -e "$KEBAPP_BACKUP_DIR")"
RESOLVED_DUMP="$(realpath -e "$DUMP_PATH")"
case "$RESOLVED_DUMP" in
  "${BACKUP_ROOT}"/kebapp-*.dump) ;;
  *)
    echo "Der Dump liegt nicht im Kebapp-Backup-Verzeichnis." >&2
    exit 1
    ;;
esac

DATABASE_EXISTS="$(
  compose "$RELEASE_DIR" exec -T postgres \
    psql --username "$POSTGRES_OWNER_USER" --dbname postgres --tuples-only --no-align \
    --command "select 1 from pg_database where datname = '${TARGET_DATABASE}'"
)"
if [[ "$DATABASE_EXISTS" == "1" ]]; then
  echo "Die Prüf-Datenbank existiert bereits; es wurde nichts überschrieben." >&2
  exit 1
fi

compose "$RELEASE_DIR" exec -T postgres \
  createdb --username "$POSTGRES_OWNER_USER" --template template0 "$TARGET_DATABASE"

if ! compose "$RELEASE_DIR" exec -T postgres \
  pg_restore \
  --username "$POSTGRES_OWNER_USER" \
  --dbname "$TARGET_DATABASE" \
  --exit-on-error <"$RESOLVED_DUMP"; then
  echo "Restore fehlgeschlagen; die unvollständige Prüf-Datenbank bleibt zur Diagnose bestehen." >&2
  exit 1
fi

compose "$RELEASE_DIR" exec -T postgres \
  psql --username "$POSTGRES_OWNER_USER" --dbname "$TARGET_DATABASE" \
  --command "select count(*) as demo_users from public.\"user\";"

echo "Restore in Prüf-Datenbank abgeschlossen: ${TARGET_DATABASE}"
