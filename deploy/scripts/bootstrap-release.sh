#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Bootstrap als deploy-Benutzer mit sudo-Rechten ausführen." >&2
  exit 1
fi

install -d -m 0750 "$KEBAPP_ROOT/releases" "$KEBAPP_ROOT/shared" "$KEBAPP_ROOT/state"
sudo install -d -m 0700 -o "$(id -un)" -g "$(id -gn)" "$KEBAPP_BACKUP_DIR"

RELEASE_DIR="$(resolve_release_dir)"
sudo install -m 0644 \
  "${RELEASE_DIR}/deploy/systemd/kebapp-backup.service" \
  /etc/systemd/system/kebapp-backup.service
sudo install -m 0644 \
  "${RELEASE_DIR}/deploy/systemd/kebapp-backup.timer" \
  /etc/systemd/system/kebapp-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable kebapp-backup.timer

if [[ -e "$KEBAPP_ENV_FILE" ]]; then
  chmod 0600 "$KEBAPP_ENV_FILE"
fi

echo "Kebapp-Verzeichnisse und Backup-Timer sind vorbereitet."
