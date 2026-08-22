#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

load_production_env
BASE_URL="https://${KEBAPP_HOST}"

curl_retry() {
  curl \
    --fail \
    --silent \
    --show-error \
    --retry 10 \
    --retry-all-errors \
    --retry-delay 3 \
    --connect-timeout 5 \
    --max-time 20 \
    "$@"
}

REDIRECT_HEADERS="$(mktemp)"
HEALTH_BODY="$(mktemp)"
PUBLIC_BODY="$(mktemp)"
DEMO_BODY="$(mktemp)"
cleanup() {
  rm -f -- "$REDIRECT_HEADERS" "$HEALTH_BODY" "$PUBLIC_BODY" "$DEMO_BODY"
}
trap cleanup EXIT

curl \
  --silent \
  --show-error \
  --retry 10 \
  --retry-all-errors \
  --retry-delay 3 \
  --connect-timeout 5 \
  --max-time 20 \
  --dump-header "$REDIRECT_HEADERS" \
  --output /dev/null \
  "http://${KEBAPP_HOST}/"

if ! grep -Eq '^HTTP/[^ ]+ 30(1|2|7|8)' "$REDIRECT_HEADERS"; then
  echo "HTTP wird nicht auf HTTPS umgeleitet." >&2
  exit 1
fi

curl_retry --output "$HEALTH_BODY" "${BASE_URL}/api/health"
if ! grep -Fq '"status":"ok"' "$HEALTH_BODY"; then
  echo "Der öffentliche Healthcheck ist nicht gesund." >&2
  exit 1
fi

curl_retry --output "$PUBLIC_BODY" "${BASE_URL}/laden/ocakbasi-rheydt"
if ! grep -Fq "Ocakbasi Rheydt" "$PUBLIC_BODY"; then
  echo "Die veröffentlichte Demo-Website fehlt." >&2
  exit 1
fi

UNPUBLISHED_STATUS="$(
  curl --silent --show-error --retry 5 --retry-all-errors --retry-delay 2 \
    --connect-timeout 5 --max-time 20 --output /dev/null --write-out '%{http_code}' \
    "${BASE_URL}/laden/mangal-am-markt"
)"
if [[ "$UNPUBLISHED_STATUS" != "404" ]]; then
  echo "Die unveröffentlichte Demo-Website ist unerwartet erreichbar." >&2
  exit 1
fi

curl_retry --output "$DEMO_BODY" "${BASE_URL}/registrieren"
if ! grep -Fq "Demo deaktiviert" "$DEMO_BODY"; then
  echo "Der öffentliche Demo-Hinweis fehlt." >&2
  exit 1
fi

echo "Öffentlicher Smoke-Test erfolgreich: ${BASE_URL}"
