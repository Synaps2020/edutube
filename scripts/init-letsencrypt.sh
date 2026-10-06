#!/bin/sh
# Obtention initiale d'un certificat Let's Encrypt (le serveur doit être joignable publiquement sur le port 80).
# Usage : sh scripts/init-letsencrypt.sh medias.education.sn admin@education.sn
set -eu
DOMAIN=${1:?domaine}
EMAIL=${2:?email}
# 1) démarrer nginx en HTTP simple pour le challenge
TLS_MODE=off docker compose up -d nginx
# 2) obtenir le certificat (nom fixe "default" attendu par nginx/tls/letsencrypt-https.conf)
docker compose run --rm --entrypoint certbot certbot certonly --webroot -w /var/www/certbot --cert-name default -d "$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email
# 3) basculer en HTTPS
sed -i "s/^TLS_MODE=.*/TLS_MODE=letsencrypt/; s/^COOKIE_SECURE=.*/COOKIE_SECURE=true/; s#^APP_URL=.*#APP_URL=https://$DOMAIN#; s/^SERVER_NAME=.*/SERVER_NAME=$DOMAIN/" .env
docker compose up -d nginx app
docker compose --profile letsencrypt up -d certbot
echo "✔ HTTPS actif sur https://$DOMAIN (renouvellement automatique par le conteneur certbot)"
