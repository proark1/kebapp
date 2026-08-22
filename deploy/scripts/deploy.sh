#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

RELEASE_TAG="${1:-}"
if [[ ! "$RELEASE_TAG" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$ ]]; then
  echo "Aufruf: $0 RELEASE_TAG" >&2
  exit 2
fi

load_production_env
RELEASE_DIR="$(resolve_release_dir)"
APP_IMAGE="kebapp-app:${RELEASE_TAG}"
TOOLING_IMAGE="kebapp-tooling:${RELEASE_TAG}"
PREVIOUS_IMAGE="$(
  compose "$RELEASE_DIR" ps -q app 2>/dev/null \
    | xargs -r docker inspect --format '{{.Config.Image}}' 2>/dev/null \
    || true
)"

export KEBAPP_APP_IMAGE="$APP_IMAGE"
export KEBAPP_TOOLING_IMAGE="$TOOLING_IMAGE"

compose "$RELEASE_DIR" build --pull app migrate

if [[ -n "$(compose "$RELEASE_DIR" ps --status running -q postgres 2>/dev/null || true)" ]]; then
  "${SCRIPT_DIR}/backup-postgres.sh"
fi

compose "$RELEASE_DIR" up -d postgres
POSTGRES_CONTAINER="$(compose "$RELEASE_DIR" ps -q postgres)"
wait_for_healthy_container "$POSTGRES_CONTAINER"

compose "$RELEASE_DIR" run --rm migrate
compose "$RELEASE_DIR" run --rm seed
compose "$RELEASE_DIR" up -d --no-deps app

APP_CONTAINER="$(compose "$RELEASE_DIR" ps -q app)"
if ! wait_for_healthy_container "$APP_CONTAINER"; then
  if [[ "$PREVIOUS_IMAGE" =~ ^kebapp-app: ]]; then
    export KEBAPP_APP_IMAGE="$PREVIOUS_IMAGE"
    compose "$RELEASE_DIR" up -d --no-deps app
  fi
  exit 1
fi

compose "$RELEASE_DIR" up -d --no-deps caddy
if ! "${SCRIPT_DIR}/smoke-test.sh"; then
  if [[ "$PREVIOUS_IMAGE" =~ ^kebapp-app: ]]; then
    export KEBAPP_APP_IMAGE="$PREVIOUS_IMAGE"
    compose "$RELEASE_DIR" up -d --no-deps app
    ROLLBACK_CONTAINER="$(compose "$RELEASE_DIR" ps -q app)"
    wait_for_healthy_container "$ROLLBACK_CONTAINER"
  fi
  echo "Deployment-Smoke-Test fehlgeschlagen; die vorherige App wurde wieder aktiviert." >&2
  exit 1
fi

if [[ "$PREVIOUS_IMAGE" =~ ^kebapp-app: && "$PREVIOUS_IMAGE" != "$APP_IMAGE" ]]; then
  printf '%s\n' "$PREVIOUS_IMAGE" >"${KEBAPP_ROOT}/state/previous-app-image"
fi
printf '%s\n' "$APP_IMAGE" >"${KEBAPP_ROOT}/state/current-app-image"
ln -sfn "$RELEASE_DIR" "${KEBAPP_ROOT}/current.next"
mv -Tf "${KEBAPP_ROOT}/current.next" "${KEBAPP_ROOT}/current"
sudo systemctl start kebapp-backup.timer

echo "Kebapp-Deployment erfolgreich: ${APP_IMAGE}"
