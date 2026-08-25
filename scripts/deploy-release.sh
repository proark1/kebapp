#!/usr/bin/env bash
# Kebapp-Einzelbefehl-Deployment von einem Rechner mit Server-Zugang.
# Nutzung: bash scripts/deploy-release.sh [SHORT_SHA]
set -Eeuo pipefail

SHA="${1:-$(git rev-parse --short HEAD)}"
HOST="deploy@178.105.107.243"
KEY="$HOME/.ssh/kebapp-demo"

echo "== Kebapp Release $SHA =="
git archive --format=tar.gz -o /tmp/kebapp-$SHA.tar.gz HEAD

for attempt in 1 2 3; do
  if scp -q -o BatchMode=yes -o ConnectTimeout=15 -i "$KEY" \
      "/tmp/kebapp-$SHA.tar.gz" "$HOST:/tmp/k.tgz"; then
    break
  fi
  echo "Upload-Versuch $attempt fehlgeschlagen." >&2
  [[ $attempt -eq 3 ]] && exit 1
  sleep 20
done

ssh -o BatchMode=yes -i "$KEY" "$HOST" bash -s -- "$SHA" <<'REMOTE'
set -Eeuo pipefail
SHA="$1"
rm -rf "/opt/kebapp/releases/$SHA"
mkdir -p "/opt/kebapp/releases/$SHA"
tar -xzf /tmp/k.tgz -C "/opt/kebapp/releases/$SHA"
rm /tmp/k.tgz
cd "/opt/kebapp/releases/$SHA"
bash deploy/scripts/deploy.sh "$SHA"
REMOTE

echo "== Fertig: https://178-105-107-243.sslip.io =="