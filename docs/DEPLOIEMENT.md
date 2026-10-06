# Guide de déploiement on-premise — EduTube

Ce guide s'adresse à l'équipe d'exploitation du SIMEN / de la cellule informatique du Ministère. Il couvre l'installation sur un serveur du Ministère, la mise en HTTPS, les sauvegardes, la supervision et les évolutions de capacité.

## 1. Prérequis serveur

### 1.1 Dimensionnement indicatif

| Profil | CPU | RAM | Disque | Usage |
|---|---|---|---|---|
| Pilote (une IA, quelques centaines d'utilisateurs) | 4 vCPU | 8 Go | 200 Go SSD | app + worker + base sur un seul hôte |
| National (démarrage) | 8 vCPU | 16 Go | 1 To SSD (médias) + 100 Go (système/base) | worker transcodage sur 2–4 cœurs |
| National (montée en charge) | 2 hôtes app/nginx + 1–2 hôtes worker + 1 hôte PostgreSQL + stockage MinIO | — | plusieurs To | voir §8 |

Le transcodage vidéo est l'opération la plus coûteuse : compter ~1× la durée de la vidéo par cœur avec le préréglage `veryfast` pour 3 rendus (720p source). Le stockage moyen : ~1 Go par heure de vidéo (original + rendus HLS), ~60 Mo par heure d'audio.

### 1.2 Système

- Linux 64 bits maintenu : Debian 12, Ubuntu 22.04/24.04 LTS, Rocky/Alma 9.
- Accès administrateur (`sudo`), horloge synchronisée (`chrony`/`systemd-timesyncd`), locale UTF-8.
- Ports ouverts en entrée : **80** et **443** depuis le réseau des utilisateurs (Internet ou réseau interne du Ministère). Rien d'autre n'est exposé.
- Nom de domaine (ex. `medias.education.sn`) pointant vers l'adresse publique ou interne du serveur.
- Pare-feu : `ufw allow 80,443/tcp` (ou équivalent), SSH restreint aux adresses d'administration.

### 1.3 Installation de Docker

```bash
# Debian / Ubuntu
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/$(. /etc/os-release; echo $ID)/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release; echo $ID) $(. /etc/os-release; echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker
docker compose version
```

Si le serveur n'a pas d'accès Internet, construire l'image sur un poste connecté (`docker build -t edutube:latest .`), l'exporter (`docker save edutube:latest | gzip > edutube.tar.gz`) ainsi que les images `postgres:16-alpine`, `nginx:1.27-alpine`, puis les importer sur le serveur (`docker load`). Dans ce cas, retirer `--build` des commandes ci-dessous.

## 2. Installation

```bash
sudo mkdir -p /opt/edutube && sudo chown $USER /opt/edutube && cd /opt/edutube
git clone <dépôt> . # ou décompresser l'archive livrée
cp .env.example .env
```

Éditer `.env` (toutes les variables sont documentées dans le fichier). Au minimum :

| Variable | Valeur |
|---|---|
| `POSTGRES_PASSWORD` | mot de passe fort |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `APP_URL` | `https://medias.education.sn` (ou `http://…` le temps des tests) |
| `SERVER_NAME` | `medias.education.sn` |
| `SEED_DEMO_PASSWORD` | mot de passe initial des comptes de démonstration |
| `SSO_ADMIN_EMAILS` | adresses e-mail Entra ID autorisées à recevoir le rôle `ADMIN`, séparées par des virgules |
| `SMTP_*` | serveur de messagerie du Ministère (sinon e-mails journalisés) |
| `ALLOW_SELF_REGISTRATION` | `true` (auto-inscription) ou `false` (comptes créés par l'administration / import) |

Lancement :

```bash
docker compose up -d --build
docker compose ps                 # tous les services "healthy" / migrate "exited (0)"
docker compose logs -f migrate    # migrations + seed
docker compose logs -f worker     # transcodage des médias de démonstration
  curl -s http://localhost:8081/api/v1/health
```

Le volume `media` (données) et `pgdata` (base) sont des volumes Docker nommés. Pour utiliser un disque dédié, remplacer dans `docker-compose.yml` le volume `media:` par un bind mount (`/srv/edutube/media:/data/media`) et donner la propriété du dossier à l'utilisateur applicatif de l'image : `sudo chown -R 1001:1001 /srv/edutube/media`.

### 2.1 Première connexion

Se connecter avec `admin@education.sn` / `SEED_DEMO_PASSWORD`, puis **immédiatement** :

1. Créer les comptes administrateurs nominatifs (Administration → Utilisateurs → Créer un compte) ;
2. Changer le mot de passe des comptes de démonstration ou les suspendre ; supprimer les contenus de test (Administration → Contenus) ;
3. Positionner `SEED_DEMO=false` dans `.env` (le conteneur `migrate` n'exécutera plus le seed aux redémarrages ; les migrations restent appliquées automatiquement) ;
4. Vérifier les référentiels (cycles, classes, disciplines, thématiques) et les chaînes officielles.

### 2.2 Mise à jour

```bash
git pull                       # ou remplacer les sources
docker compose build app       # reconstruit l'image (app + worker partagent la même image)
docker compose up -d           # migrate applique les nouvelles migrations puis app/worker redémarrent
```

## 3. HTTPS

Trois modes via `TLS_MODE` dans `.env` : `off` (tests), `internal`, `letsencrypt`.

### 3.1 Certificat interne (autorité du Ministère)

1. Déposer `fullchain.pem` (certificat + chaîne) et `privkey.pem` dans `nginx/certs/internal/`.
   Pour un test : `sh scripts/gen-self-signed.sh medias.education.sn`.
2. `.env` : `TLS_MODE=internal`, `COOKIE_SECURE=true`, `APP_URL=https://…`.
3. `docker compose up -d nginx app`.

Les postes clients doivent faire confiance à l'autorité interne (déploiement du certificat racine par GPO / MDM).

### 3.2 Let's Encrypt (serveur joignable depuis Internet)

```bash
sh scripts/init-letsencrypt.sh medias.education.sn admin@education.sn
```

Le script démarre Nginx en HTTP, obtient le certificat (webroot, nom `default`), bascule `.env` en `TLS_MODE=letsencrypt` / `COOKIE_SECURE=true`, relance Nginx et démarre le conteneur `certbot` (profil `letsencrypt`) qui renouvelle automatiquement. Nginx recharge les certificats à chaque redémarrage ; ajouter une tâche cron mensuelle `docker compose exec nginx nginx -s reload`.

### 3.3 Sécurité Nginx

`nginx/nginx.conf` et `nginx/snippets/locations.conf` appliquent : TLS 1.2/1.3, HSTS, CSP, `X-Frame-Options`, `nosniff`, limitation de débit (`/api/v1/auth/` 5 req/min/IP, `/api/` 30 req/s/IP), `client_max_body_size 2100m` (aligner avec `MAX_UPLOAD_MB`), interdiction d'accès aux originaux (`/media/originals/`, `/media/submissions/`), restriction de `/api/v1/metrics` aux réseaux privés.

## 4. Sauvegardes

Le service `backup` exécute chaque jour à `BACKUP_HOUR` (02 h par défaut) `scripts/backup.sh` :

- `backups/db/edutube-AAAAMMJJ-HHMM.sql.gz` : `pg_dump` compressé ;
- `backups/media/media-AAAAMMJJ-HHMM.tar` : archive **incrémentale** du volume médias (`tar --listed-incremental`, instantané `snapshot.snar`) ;
- rotation après `BACKUP_RETENTION_DAYS` jours.

Le dossier `backups/` doit être **copié hors du serveur** (rsync vers un NAS du Ministère, bande, site distant) : par exemple une tâche cron `rsync -a /opt/edutube/backups/ sauvegarde@nas:/edutube/`. Tester régulièrement la restauration :

```bash
sh scripts/restore.sh backups/db/edutube-20260819-0200.sql.gz backups/media/media-20260819-0200.tar
```

Sauvegarde manuelle immédiate : `docker compose exec backup sh /backup.sh`.

## 5. Supervision et journaux

### 5.1 Journaux

`docker compose logs -f [app|worker|nginx|postgres]`. Configurer la rotation Docker dans `/etc/docker/daemon.json` : `{"log-driver":"json-file","log-opts":{"max-size":"50m","max-file":"5"}}`. Le journal d'audit applicatif (actions administratives, connexions) est consultable dans Administration → Journal d'audit et exportable en CSV.

### 5.2 Monitoring Prometheus / Grafana

```bash
docker compose --profile monitoring up -d
```

- Prometheus collecte `/api/v1/metrics` de l'application (utilisateurs, médias par statut, jobs, vues 24 h, propositions, signalements), `postgres-exporter`, `node-exporter`.
- Grafana : `https://<domaine>/grafana/` (identifiants `GRAFANA_ADMIN_*`), tableau « EduTube — Vue d'ensemble » provisionné.
- Alertes (`monitoring/alerts.yml`) : application indisponible, file de traitement bloquée, échecs de transcodage, disque presque plein, PostgreSQL indisponible. Brancher Alertmanager (e-mail SMTP du Ministère) pour la notification.
- Sonde simple : `GET /api/v1/health` (à intégrer dans la supervision existante, ex. Zabbix / Nagios).

### 5.3 Mode dégradé

- Si le worker est arrêté, les téléversements sont acceptés et restent « Traitement en cours » ; ils sont traités au redémarrage (reprise des jobs orphelins après 3 h).
- Si SMTP est injoignable, les notifications internes restent délivrées (cloche) ; les e-mails sont journalisés.
- Les segments HLS populaires sont mis en cache par Nginx ; les lecteurs démarrent au débit le plus bas et s'adaptent (connectivité limitée).

## 6. Exploitation courante

| Tâche | Commande / écran |
|---|---|
| Relancer un transcodage en échec | Administration → Paramètres & exports → File de traitement → Relancer |
| Augmenter la capacité de transcodage | `docker compose up -d --scale worker=3` (ou `WORKER_CONCURRENCY`) |
| Export CSV | Administration → Paramètres & exports |
| Quotas (propositions/semaine, taille, commentaires) | Administration → Paramètres & exports |
| Annonce en page d'accueil | Paramètre `platform.announcement` |
| Créer un administrateur | Administration → Utilisateurs → Créer un compte |
| Purger les fichiers temporaires | `docker compose exec app sh -c 'find /data/media/tmp -mtime +1 -delete'` (cron hebdomadaire) |

## 7. Sécurité — liste de contrôle

- [ ] `JWT_SECRET` et `POSTGRES_PASSWORD` uniques et forts ; `.env` en lecture seule (`chmod 600`).
- [ ] HTTPS actif, `COOKIE_SECURE=true`, HSTS (automatique en TLS).
- [ ] Comptes de démonstration neutralisés, `SEED_DEMO=false`.
- [ ] Sauvegardes externalisées et testées.
- [ ] Mises à jour de sécurité de l'hôte et des images (`docker compose pull` pour postgres/nginx, reconstruction de l'image app).
- [ ] Accès SSH par clés, pare-feu limité à 80/443.
- [ ] Revue mensuelle du journal d'audit et des signalements.

## 8. Mise à l'échelle future

### 8.1 Worker de transcodage séparé

Le worker ne dépend que de la base et du stockage. Sur un hôte dédié :

```bash
docker run -d --name edu-worker --restart unless-stopped \
  -e DATABASE_URL='postgresql://edu:…@ip-base:5432/edutube' -e MEDIA_ROOT=/data/media \
  -e WORKER_CONCURRENCY=4 -v /mnt/edutube-media:/data/media \
  edutube:latest node node_modules/tsx/dist/cli.mjs worker/index.ts
```

Le stockage doit alors être partagé (NFS/CIFS monté sur les deux hôtes) ou objet (§8.2). Plusieurs workers cohabitent sans conflit grâce au verrouillage `FOR UPDATE SKIP LOCKED`. Un hôte équipé d'un GPU peut utiliser un encodeur matériel en remplaçant `libx264` par `h264_nvenc`/`h264_vaapi` dans `worker/index.ts`.

### 8.2 Stockage objet MinIO (compatible S3, auto-hébergé)

1. Déployer MinIO (distribué, 4 nœuds minimum pour la tolérance aux pannes) sur les serveurs du Ministère.
2. Adapter `src/lib/storage.ts` (seul point d'accès au système de fichiers : `abs`, `saveUpload`, `publicUrl`, `removeRel`) et l'écriture des rendus dans `worker/index.ts` pour utiliser le SDK S3 (`@aws-sdk/client-s3`, pointé sur l'URL MinIO) : téléverser les rendus après transcodage, générer des URL publiques `MEDIA_PUBLIC_BASE=https://minio.education.sn/edutube-public/`.
3. Faire servir le bucket public par Nginx (`proxy_pass` vers MinIO avec `proxy_cache`) pour conserver le cache HLS et les en-têtes.
4. Conserver les originaux dans un bucket privé (politique de rétention / versionnage).

### 8.3 Base de données

PostgreSQL sur un hôte dédié, réplication en flux vers un secondaire (`repmgr` ou Patroni), `pgBouncer` pour le pooling si plus de 2 instances d'application. Sauvegardes `pgBackRest` (PITR).

### 8.4 Plusieurs instances d'application

`docker compose up -d --scale app=3` derrière Nginx (l'upstream `app` est résolu par le DNS interne Docker ; ajouter `resolver 127.0.0.11` et `zone` dans l'upstream pour l'équilibrage) ou Kubernetes (Deployment app, Deployment worker, PVC ReadWriteMany ou MinIO, Ingress). Le rate limiting applicatif étant par processus, s'appuyer sur celui de Nginx.

### 8.5 CDN régional / connectivité limitée

Les segments HLS sont immuables et cacheables : déployer des **caches Nginx régionaux** (IA de Saint-Louis, Ziguinchor, Tambacounda…) en `proxy_cache` devant le serveur central (`proxy_cache_path … max_size=200g`, `proxy_cache_valid 200 30d`), et pointer les utilisateurs de la région via DNS (GeoDNS ou entrée par académie). Un cache dans un établissement (boîtier Raspberry Pi / mini-PC avec Nginx) permet la lecture sur le réseau local même avec une liaison faible. Le lecteur démarre en 240p et s'adapte ; le paramètre `maxBufferLength` est réduit automatiquement quand le navigateur signale une connexion lente.

## 9. Dépannage

| Symptôme | Piste |
|---|---|
| `migrate` en erreur « permission denied for extension » | l'utilisateur PostgreSQL doit pouvoir créer `pg_trgm`/`unaccent` (superutilisateur du conteneur par défaut ; sur une base externe, pré-créer les extensions) |
| Vidéo « Traitement en cours » indéfiniment | `docker compose logs worker` ; vérifier FFmpeg, espace disque, job en FAILED → Relancer |
| 413 au téléversement | augmenter `MAX_UPLOAD_MB` et `client_max_body_size` (nginx.conf), puis `docker compose restart nginx` |
| Lecture impossible sur un poste | vérifier que `/media/hls/.../master.m3u8` répond (cache, CSP `media-src blob:`), navigateur à jour |
| E-mails non reçus | `SMTP_*` ; en l'absence de SMTP les messages sont dans `docker compose logs app` (`[mail:simulé]`) |
