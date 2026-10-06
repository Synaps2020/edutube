#!/bin/sh
# Génère un certificat auto-signé pour TLS_MODE=internal (tests / réseau interne sans autorité).
# Usage : sh scripts/gen-self-signed.sh medias.education.sn
set -eu
DOMAIN=${1:-localhost}
mkdir -p nginx/certs/internal
openssl req -x509 -nodes -newkey rsa:4096 -days 825 -keyout nginx/certs/internal/privkey.pem -out nginx/certs/internal/fullchain.pem \
  -subj "/C=SN/ST=Dakar/L=Dakar/O=Ministere de l'Education nationale/OU=SIMEN/CN=$DOMAIN" -addext "subjectAltName=DNS:$DOMAIN"
echo "✔ certificat généré dans nginx/certs/internal/ (CN=$DOMAIN)"
