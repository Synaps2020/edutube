# Certificats TLS

- **Mode `internal`** : déposer ici `internal/fullchain.pem` et `internal/privkey.pem`
  (certificat délivré par l'autorité interne du Ministère, ou auto-signé pour un test :
  `scripts/gen-self-signed.sh <nom-de-domaine>`).
- **Mode `letsencrypt`** : ce dossier est monté sur `/etc/letsencrypt` du conteneur certbot ;
  les certificats sont dans `live/default/`.

Ne jamais versionner les clés privées.
