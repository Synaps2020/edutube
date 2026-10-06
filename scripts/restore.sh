#!/bin/sh
# Restauration : sh scripts/restore.sh backups/db/edutube-XXXX.sql.gz [backups/media/media-XXXX.tar ...]
# À exécuter depuis l'hôte, la pile docker compose étant démarrée (postgres) ; l'app est arrêtée le temps de la restauration.
set -eu
DB_DUMP=${1:?chemin du dump .sql.gz}
shift || true
docker compose stop app worker
echo "→ restauration de la base depuis $DB_DUMP"
gunzip -c "$DB_DUMP" | docker compose exec -T postgres psql -U "${POSTGRES_USER:-edu}" -d "${POSTGRES_DB:-edutube}" -v ON_ERROR_STOP=0 >/dev/null
for ARCHIVE in "$@"; do
  echo "→ restauration des médias depuis $ARCHIVE"
  docker compose run --rm -v "$(pwd)/$ARCHIVE:/restore.tar:ro" --entrypoint sh app -c "tar --listed-incremental=/dev/null -xf /restore.tar -C /data/media"
done
docker compose start app worker
echo "✔ restauration terminée"
