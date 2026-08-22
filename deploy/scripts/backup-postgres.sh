#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

load_production_env
RELEASE_DIR="$(resolve_release_dir)"
RETENTION_DAYS="${KEBAPP_BACKUP_RETENTION_DAYS:-14}"

if [[ ! "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || ((RETENTION_DAYS < 1 || RETENTION_DAYS > 365)); then
  echo "Ungültige Backup-Aufbewahrung." >&2
  exit 1
fi

install -d -m 0700 "$KEBAPP_BACKUP_DIR"
BACKUP_ROOT="$(realpath -e "$KEBAPP_BACKUP_DIR")"
case "$BACKUP_ROOT" in
  /var/backups/kebapp|/var/backups/kebapp/*|/tmp/kebapp-backups|/tmp/kebapp-backups/*) ;;
  *)
    echo "Backup-Ziel liegt außerhalb des erlaubten Verzeichnisses." >&2
    exit 1
    ;;
esac

exec 9>"${BACKUP_ROOT}/.backup.lock"
flock -n 9 || {
  echo "Ein Datenbank-Backup läuft bereits." >&2
  exit 1
}

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FINAL_PATH="${BACKUP_ROOT}/kebapp-${TIMESTAMP}.dump"
TEMP_PATH="$(mktemp "${BACKUP_ROOT}/.pending.XXXXXX.dump")"

cleanup() {
  if [[ -f "$TEMP_PATH" ]]; then
    rm -f -- "$TEMP_PATH"
  fi
}
trap cleanup EXIT

compose "$RELEASE_DIR" exec -T postgres \
  pg_dump \
  --username "$POSTGRES_OWNER_USER" \
  --dbname "$POSTGRES_DB" \
  --format custom \
  --compress 9 \
  --no-owner \
  --no-privileges >"$TEMP_PATH"

if [[ ! -s "$TEMP_PATH" ]]; then
  echo "Der erzeugte Datenbank-Dump ist leer." >&2
  exit 1
fi

chmod 0600 "$TEMP_PATH"
mv -- "$TEMP_PATH" "$FINAL_PATH"

while IFS= read -r -d '' OLD_BACKUP; do
  RESOLVED_OLD_BACKUP="$(realpath -e "$OLD_BACKUP")"
  case "$RESOLVED_OLD_BACKUP" in
    "${BACKUP_ROOT}"/kebapp-*.dump) rm -f -- "$RESOLVED_OLD_BACKUP" ;;
    *)
      echo "Altes Backup liegt außerhalb des erwarteten Ziels." >&2
      exit 1
      ;;
  esac
done < <(find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'kebapp-*.dump' -mtime "+${RETENTION_DAYS}" -print0)

trap - EXIT
echo "Datenbank-Backup erstellt: ${FINAL_PATH}"
