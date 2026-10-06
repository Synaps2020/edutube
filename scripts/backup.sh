#!/bin/sh
# Sauvegarde base de données (pg_dump compressé) + médias (archive tar incrémentale par date).
# Variables : PGHOST PGUSER PGPASSWORD PGDATABASE BACKUP_RETENTION_DAYS (défaut 14)
# Sortie : /backups/db/edutube-YYYYmmdd-HHMM.sql.gz et /backups/media/media-YYYYmmdd.tar
set -eu
STAMP=$(date +%Y%m%d-%H%M)
RET=${BACKUP_RETENTION_DAYS:-14}
mkdir -p /backups/db /backups/media
echo "[backup] $STAMP — base de données"
pg_dump --no-owner --no-privileges "$PGDATABASE" | gzip -9 > "/backups/db/edutube-$STAMP.sql.gz"
echo "[backup] $STAMP — médias (hls, audio, thumbs, waveforms, subtitles, originals)"
# Archive uniquement les fichiers modifiés depuis la dernière sauvegarde complète via un fichier d'instantané (tar --listed-incremental)
tar --listed-incremental=/backups/media/snapshot.snar -cf "/backups/media/media-$STAMP.tar" -C /data/media . 2>/dev/null || tar -cf "/backups/media/media-$STAMP.tar" -C /data/media .
echo "[backup] rotation (> $RET jours)"
find /backups/db -name '*.sql.gz' -mtime +"$RET" -delete
find /backups/media -name 'media-*.tar' -mtime +"$RET" -delete
echo "[backup] terminé"
