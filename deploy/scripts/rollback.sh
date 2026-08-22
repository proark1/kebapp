#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

TARGET_IMAGE="${1:-}"
if [[ ! "$TARGET_IMAGE" =~ ^kebapp-app:[a-zA-Z0-9._-]+$ ]]; then
  echo "Aufruf: $0 kebapp-app:RELEASE" >&2
  exit 2
fi

docker image inspect "$TARGET_IMAGE" >/dev/null
load_production_env
RELEASE_DIR="$(resolve_release_dir)"

export KEBAPP_APP_IMAGE="$TARGET_IMAGE"
compose "$RELEASE_DIR" up -d --no-deps app
APP_CONTAINER="$(compose "$RELEASE_DIR" ps -q app)"
wait_for_healthy_container "$APP_CONTAINER"
"${SCRIPT_DIR}/smoke-test.sh"

printf '%s\n' "$TARGET_IMAGE" >"${KEBAPP_ROOT}/state/current-app-image"
echo "App-Rollback abgeschlossen: ${TARGET_IMAGE}"
