#!/usr/bin/env bash

set -Eeuo pipefail

KEBAPP_ROOT="${KEBAPP_ROOT:-/opt/kebapp}"
KEBAPP_ENV_FILE="${KEBAPP_ENV_FILE:-${KEBAPP_ROOT}/shared/.env.production}"
KEBAPP_BACKUP_DIR="${KEBAPP_BACKUP_DIR:-/var/backups/kebapp}"

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "Erforderliche Datei fehlt: $1" >&2
    return 1
  fi
}

load_production_env() {
  require_file "$KEBAPP_ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$KEBAPP_ENV_FILE"
  set +a

  : "${POSTGRES_DB:?POSTGRES_DB fehlt}"
  : "${POSTGRES_OWNER_USER:?POSTGRES_OWNER_USER fehlt}"
  : "${KEBAPP_HOST:?KEBAPP_HOST fehlt}"

  if [[ "${DEMO_MODE:-}" != "true" ]]; then
    echo "Dieses Deployment ist ausschließlich für DEMO_MODE=true vorgesehen." >&2
    return 1
  fi
}

resolve_release_dir() {
  local script_dir
  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[1]}")" && pwd -P)"
  cd -- "${script_dir}/../.." && pwd -P
}

compose() {
  local release_dir="$1"
  shift
  (
    cd -- "$release_dir"
    docker compose \
      --env-file "$KEBAPP_ENV_FILE" \
      --file compose.production.yaml \
      "$@"
  )
}

wait_for_healthy_container() {
  local container_id="$1"
  local attempts="${2:-40}"
  local state

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
    if [[ "$state" == "healthy" ]]; then
      return 0
    fi
    if [[ "$state" == "exited" || "$state" == "dead" || "$state" == "unhealthy" ]]; then
      echo "Container wurde nicht gesund: ${state}" >&2
      return 1
    fi
    sleep 3
  done

  echo "Zeitüberschreitung beim Warten auf einen gesunden Container." >&2
  return 1
}
