# EduTube

Plateforme officielle, souveraine et modérée, de gestion et de diffusion de contenus pédagogiques **vidéo et audio** du **Ministère de l'Éducation nationale de la République du Sénégal** (opérée par le SIMEN). Destinée aux élèves et enseignants des cycles Primaire (CI → CM2), Moyen (6e → 3e) et Secondaire (Seconde → Terminale).

Prototype fonctionnel, déployable on-premise en une commande. Identité visuelle conforme à la charte graphique du SIMEN (bleu `#0099CC`, orange `#FF9900`, gris, typographie Trebuchet MS ; logotype sur fond blanc, jamais déformé), couleurs nationales en accent discret.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Démarrage rapide — production (Docker)](#démarrage-rapide--production-docker)
- [Démarrage rapide — développement](#démarrage-rapide--développement)
- [Comptes de démonstration](#comptes-de-démonstration)
- [Structure du dépôt](#structure-du-dépôt)
- [Documentation](#documentation)

## Fonctionnalités

| Domaine | Contenu |
|---|---|
| Rôles | Administrateur (MEN) · Enseignant · Élève · Visiteur. **Seuls les administrateurs publient** ; enseignants et élèves proposent (workflow de validation, retour motivé). |
| Catalogue | Double clé thématique × discipline ; filtres cycle, classe, niveau, langue (FR/WO/AR/EN), durée, date ; tri ; recherche plein texte PostgreSQL (titre, description, mots-clés, transcription, insensible aux accents, tolérante aux fautes) + suggestions. |
| Lecteur vidéo | HLS adaptatif (240p/480p/720p/1080p bornés par la source, hls.js / natif Safari), reprise de lecture, sous-titres WebVTT, vitesse, qualité, plein écran, raccourcis clavier, mode connexion limitée. |
| Lecteur audio | Forme d'onde (pics précalculés), vitesse, écoute en arrière-plan (Media Session), téléchargement optionnel, transcription. |
| Téléversement admin | Métadonnées pédagogiques obligatoires, miniature, sous-titres, transcodage HLS (FFmpeg, worker séparé), normalisation loudness EBU R128, miniature et forme d'onde générées. Téléversement en flux (busboy) jusqu'à 2 Go. |
| Propositions | Formulaire simplifié (fichier ou lien), quota, statut « En attente », notification admins, approbation → média publié automatiquement (contributeur crédité) ou rejet motivé. |
| Modération | File de validation, signalements (contenus/commentaires), masquage, archivage, historique des décisions, journal d'audit. |
| Communauté | J'aime, commentaires (réponses, modération), partage par lien et **code court**, recommandation privée ou **diffusion à une classe**, favoris, listes de lecture publiques/privées, abonnements aux chaînes. |
| Suivi | Historique, reprise, progression, statistiques individuelles, tableau de bord d'audience admin, export CSV. |
| Admin | Utilisateurs, cycles/classes/disciplines/thématiques, chaînes, quotas, paramètres, file de traitement, métriques Prometheus. |
| Transverse | Interface FR (WO/AR en option, RTL), accessibilité (clavier, focus, ARIA, contrastes), sécurité (bcrypt, JWT httpOnly, CSRF, rate limiting, CSP/HSTS), sauvegardes, monitoring. |

## Architecture

```
Navigateur ──HTTPS──► Nginx (TLS, cache HLS, rate-limit, en-têtes) ──► Next.js 14 (pages + API REST /api/v1)
                           │                                                │
                           └──► /media/* (HLS, audio, miniatures)           └──► PostgreSQL 16 (Prisma)
                                      ▲                                              ▲
                                      └──── Worker FFmpeg (file de jobs en base, SKIP LOCKED) ┘
```

- **Next.js 14 (App Router) + TypeScript + Tailwind** : interface et API dans une même application (Route Handlers) ; l'API reste indépendante et documentée (`docs/API.md`).
- **PostgreSQL + Prisma** : schéma `prisma/schema.prisma`, migrations SQL, seed.
- **Worker FFmpeg** (`worker/index.ts`) : même image Docker, commande différente ; file de jobs stockée en base (pas de Redis à opérer) ; `--scale worker=N` pour paralléliser.
- **Stockage** : volume local `/data/media` (abstraction `src/lib/storage.ts`, évolutive vers MinIO/S3).
- **Nginx** : TLS (certificat interne ou Let's Encrypt), cache HLS, limitation de débit, CSP/HSTS.

## Démarrage rapide — production (Docker)

Prérequis : Docker Engine ≥ 24 et Docker Compose v2 (voir `docs/DEPLOIEMENT.md` pour l'installation serveur).

```bash
git clone <dépôt> edutube && cd edutube
cp .env.example .env
# Éditer .env : POSTGRES_PASSWORD, JWT_SECRET (openssl rand -base64 48), APP_URL, SERVER_NAME, SEED_DEMO_PASSWORD
docker compose up -d --build
```

Au premier lancement : construction de l'image, démarrage de PostgreSQL, migrations + jeu de données de démonstration (`migrate`), puis `app`, `worker`, `nginx`, `backup`. Les médias de démonstration sont transcodés par le worker en 1 à 3 minutes.

- Plateforme : http://localhost (ou `APP_URL`)
- État : http://localhost/api/v1/health
- Journaux : `docker compose logs -f app worker`
- Monitoring (optionnel) : `docker compose --profile monitoring up -d` → Grafana sur `/grafana/`
- HTTPS : `sh scripts/init-letsencrypt.sh medias.education.sn admin@education.sn` ou certificat interne (`TLS_MODE=internal`, voir `nginx/certs/README.md`)

Après le premier lancement en production, positionner `SEED_DEMO=false` et changer les mots de passe de démonstration (ou supprimer les comptes de démonstration).

## Démarrage rapide — développement

Prérequis : Node.js ≥ 20, PostgreSQL ≥ 14 (extensions `pg_trgm`, `unaccent` — incluses dans la distribution standard), FFmpeg.

```bash
npm install
cp .env.example .env
# DATABASE_URL=postgresql://edu:mot-de-passe@localhost:5433/edutube?schema=public  MEDIA_ROOT=./data/media  APP_URL=http://localhost:8081
npx prisma migrate deploy      # crée le schéma
npm run db:seed                # référentiels + comptes + médias de démo (génère des fichiers de test avec FFmpeg)
npm run worker                 # terminal 1 : worker de transcodage
npm run dev -- -p 8081         # terminal 2 : http://localhost:8081
```

Commandes utiles : `npm run typecheck`, `npm run lint`, `npm run build`, `npm run db:studio`.

## Comptes de démonstration

Mot de passe commun : `Passer@2026` (variable `SEED_DEMO_PASSWORD`).

| Rôle | E-mail |
|---|---|
| Administrateur | admin@education.sn · moderation@education.sn |
| Enseignant | enseignant@education.sn (Lycée Blaise Diagne) · enseignante@education.sn (CM2, Guédiawaye) |
| Élève | eleve@education.sn (3e, Thiès) · eleve2@education.sn (3e) · eleve3@education.sn (Tle, Ziguinchor) · eleve4@education.sn (CM2) |

Le seed crée 13 classes (CI → Terminale), 13 disciplines, 9 thématiques, 3 chaînes, 11 médias dans divers statuts (publiés, brouillon, archivé, rejeté), 4 propositions (en attente, approuvée, rejetée), commentaires (dont un masqué), signalements, recommandations, listes, historique et 30 jours d'événements de vue.

## Structure du dépôt

```
├─ prisma/            schéma, migrations (0001_init, 0002_fulltext), seed.ts
├─ src/app/           pages (App Router) et API REST (src/app/api/v1/**)
├─ src/components/    lecteurs, catalogue, formulaires, interface
├─ src/lib/           auth, api, validation (zod), média, stockage, upload, i18n, audit, notifications, mail
├─ worker/            worker FFmpeg (HLS, loudnorm, waveform, miniatures)
├─ nginx/             reverse proxy, TLS, cache, snippets
├─ monitoring/        Prometheus, alertes, Grafana (provisioning)
├─ scripts/           backup.sh, restore.sh, gen-self-signed.sh, init-letsencrypt.sh
├─ docs/              DEPLOIEMENT.md, MODERATION.md, CHARTE.md, API.md
├─ Dockerfile, docker-compose.yml, .env.example
```

## Documentation

- `docs/DEPLOIEMENT.md` — guide de déploiement on-premise (prérequis, Docker, HTTPS, sauvegardes, monitoring, mise à l'échelle : workers, MinIO, CDN régional).
- `docs/MODERATION.md` — guide de modération (workflow, critères, délais, sanctions, journalisation).
- `docs/CHARTE.md` — charte communautaire type (également affichée sur `/charte`).
- `docs/API.md` — référence de l'API REST.

Licence du code : à définir par le Ministère (recommandation : licence libre, p. ex. AGPL-3.0 ou EUPL-1.2). Les contenus pédagogiques sont publiés sous la licence indiquée sur chaque fiche (CC BY-NC-SA 4.0 par défaut).
