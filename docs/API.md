# API REST — EduTube

Base : `/api/v1`. Réponses JSON : `{ "data": … }` en succès, `{ "error": { "code", "message", "details?" } }` en erreur (`400` requête invalide, `401` non authentifié, `403` interdit/CSRF, `404`, `409` conflit, `413` fichier trop volumineux, `415` format, `422` validation (`details` = erreurs par champ), `429` trop de requêtes, `500`).

**Authentification** : cookie de session httpOnly (`edu_session`, JWT HS256) posé par `/auth/login` ou `/auth/register`. **CSRF** : toute requête `POST/PATCH/DELETE` doit porter l'en-tête `X-Requested-With: EduTube`. Pagination : `page`, `pageSize` → `meta { page, pageSize, total, pageCount }`.

Rôles : `ADMIN`, `TEACHER`, `STUDENT` ; 🔓 public · 🔐 authentifié · 🛡 administrateur.

## Authentification

| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | `/auth/register` | 🔓 | Création de compte `{ email, password, firstName, lastName, role: TEACHER\|STUDENT, classLevelId?, establishment?, region?, ief?, ia? }` (désactivable : `ALLOW_SELF_REGISTRATION`) |
| POST | `/auth/login` | 🔓 | `{ email, password }` → utilisateur ; limite 10/min/IP |
| POST | `/auth/logout` | 🔐 | Déconnexion |
| GET | `/auth/me` | 🔓 | Utilisateur courant (+ `unreadNotifications`, `classLevel`) ou `null` |
| PATCH | `/auth/me` | 🔐 | Profil (`firstName, lastName, locale, classLevelId, establishment, region, ief, ia, bio`) ; mot de passe (`currentPassword`, `newPassword`) |

## Référentiels et catalogue

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/taxonomy` | 🔓 | `{ cycles[{…, classes[]}], disciplines[], themes[] }` |
| GET | `/media` | 🔓 | Catalogue publié. Filtres : `q`, `type=VIDEO\|AUDIO`, `cycle`, `classe`, `discipline`, `theme` (codes), `langue=FR\|WO\|AR\|EN`, `niveau=DECOUVERTE\|INTERMEDIAIRE\|APPROFONDISSEMENT`, `duree=court\|moyen\|long`, `depuis=7j\|30j\|365j`, `chaine` (slug), `tri=recent\|populaire\|aime\|pertinence`, `page`, `pageSize` |
| GET | `/media/:key` | 🔓 | Détail par slug, id ou code court : `{ media, viewer { liked, favorited, positionSec, completed, subscribed }, related[] }` (non publié : visible par l'admin et les auteurs) |
| GET | `/search/suggest?q=` | 🔓 | Suggestions `[ { title, slug, type } ]` |
| GET | `/channels` | 🔓 | Chaînes (officielles ou avec contenus publiés) |
| GET | `/channels/:slug` | 🔓 | Chaîne + contenus (mêmes filtres que `/media`) + `subscribed` |
| POST/DELETE | `/channels/:slug/subscribe` | 🔐 | S'abonner / se désabonner |

Objet `media` (carte) : `id, slug, shortCode, type, status, title, description, thumbnailUrl, durationSec, language, difficulty, viewCount, likeCount, commentCount, publishedAt, cycle, classLevel, discipline, theme, channel, chapter, keywords[], pedagogicalAuthor, license, downloadable` ; détail : `+ hlsUrl, audioUrl, waveformUrl, subtitlesUrl, transcript, renditions[], width, height, uploader, contributor`.

## Engagement

| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST/DELETE | `/media/:key/like` | 🔐 | → `{ liked, likeCount }` |
| POST/DELETE | `/media/:key/favorite` | 🔐 | → `{ favorited }` |
| GET | `/media/:key/comments` | 🔓 | Commentaires visibles (admin : tous) |
| POST | `/media/:key/comments` | 🔐 | `{ content, parentId? }` (30/h ; validation préalable si paramétrée) |
| DELETE | `/comments/:id` | 🔐 | Auteur ou admin |
| POST | `/media/:key/progress` | 🔐 | `{ positionSec, completed? }` — reprise de lecture |
| POST | `/media/:key/view` | 🔓 | Enregistre une vue (1/h par média et par session) |
| POST | `/media/:key/recommend` | 🔐 | `{ recipientId? \| recipientEmail? \| classLevelId?, message? }` → `{ delivered, scope }` (diffusion à une classe : enseignants/admins, ou élève vers sa classe) |
| GET | `/media/:key/download` | 🔐 | Fichier (si `downloadable` ; admin toujours) |
| POST | `/reports` | 🔐 | `{ targetType: MEDIA\|COMMENT, targetId, reason, details? }` |
| GET | `/users/search?q=` | 🔐 | Destinataires possibles (infos minimales) |

## Listes de lecture

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/playlists` | 🔐 | Mes listes |
| POST | `/playlists` | 🔐 | `{ title, description?, isPublic }` |
| GET | `/playlists/:id` | 🔓/🔐 | Publique ou propriétaire/admin |
| PATCH / DELETE | `/playlists/:id` | 🔐 | Propriétaire/admin |
| POST | `/playlists/:id/items` | 🔐 | `{ mediaId }` |
| DELETE | `/playlists/:id/items?mediaId=` | 🔐 | Retirer |

## Espace personnel

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/me/history` | 🔐 | Historique + progression |
| GET | `/me/favorites` | 🔐 | Favoris |
| GET | `/me/stats` | 🔐 | Statistiques individuelles |
| GET | `/me/recommendations` | 🔐 | Recommandations reçues (personnelles + classe) |
| GET | `/me/notifications` | 🔐 | `{ items[], unread }` |
| POST | `/me/notifications/:id/read`, `/me/notifications/read-all` | 🔐 | Marquer lu |
| GET | `/me/submissions` (= `/submissions`) | 🔐 | Mes propositions |

## Propositions

| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | `/submissions` | 🔐 (enseignant/élève) | `multipart/form-data` : `title, description, type, cycleId, classLevelId, disciplineId, themeId, chapter?, keywords?, language?, sourceUrl?, file?` — quota hebdomadaire, taille max (`quota.submission.*`) |
| GET | `/submissions/:id` | 🔐 | Auteur/admin |
| DELETE | `/submissions/:id` | 🔐 | Retrait (en attente) |

## Administration (🛡)

| Méthode | Route | Description |
|---|---|---|
| GET | `/admin/media?statut=&q=&…` | Tous les contenus + job en cours |
| POST | `/admin/media` | Téléversement `multipart/form-data` : métadonnées (`title, description, type, cycleId, classLevelId, disciplineId, themeId, chapter, keywords, language, license, pedagogicalAuthor, difficulty, channelId, downloadable, publishImmediately, transcript?`) + `file` + `thumbnail?` + `subtitles?` → `{ id, slug, status: PROCESSING, jobId }` |
| GET / PATCH / DELETE | `/admin/media/:id` | Détail (jobs, décisions, proposition liée) / métadonnées / suppression définitive |
| POST | `/admin/media/:id/publish` · `/reject {reason}` · `/archive {reason?}` · `/restore` | Cycle de vie |
| POST | `/admin/media/:id/thumbnail` · `/subtitles` | multipart (`thumbnail` image, `subtitles` .vtt) |
| GET | `/admin/submissions?statut=` | File de validation |
| POST | `/admin/submissions/:id/approve {note?, overrides?}` · `/reject {reason}` | Décision (approbation : création du média si fichier joint) |
| GET | `/admin/reports?statut=` · PATCH `/admin/reports/:id {status, action, resolution}` | Signalements (`action=HIDE_TARGET` masque/archive la cible) |
| GET | `/admin/comments?statut=` · PATCH `/admin/comments/:id {status, reason?}` | Modération des commentaires |
| GET / POST | `/admin/users` · GET / PATCH `/admin/users/:id` | Utilisateurs (rôle, statut, rattachement, réinitialisation) |
| POST | `/admin/taxonomy/:kind` · PATCH / DELETE `/admin/taxonomy/:kind/:id` | `kind ∈ cycles, classes, disciplines, themes` |
| GET / POST | `/admin/channels` · PATCH / DELETE `/admin/channels/:id` | Chaînes |
| GET | `/admin/stats` | Tableau de bord d'audience |
| GET | `/admin/audit?type=audit\|moderation&q=` | Journal d'audit / décisions |
| GET | `/admin/export?type=media\|users\|views\|submissions\|audit` | CSV (`;`, UTF-8 BOM) |
| GET / PATCH | `/admin/settings` | Paramètres (`quota.submission.maxPerWeek`, `quota.submission.maxMb`, `quota.comment.maxPerHour`, `moderation.commentsRequireApproval`, `platform.announcement`) |
| GET | `/admin/jobs` · POST `/admin/jobs/:id/retry` | File de traitement |

## Technique

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | `{ status, database, jobs }` |
| GET | `/metrics` | Prometheus (en-tête `Authorization: Bearer METRICS_TOKEN` si défini ; restreint aux réseaux privés par Nginx) |
| GET | `/v/:code` (hors API) | Redirection lien court → `/media/:slug` |
| GET | `/media/*` (hors API) | Fichiers publics (HLS, audio, miniatures, waveforms, sous-titres) — servis par Nginx en production |

## Exemple

```bash
# Connexion
curl -c cj -X POST https://medias.education.sn/api/v1/auth/login \
  -H 'Content-Type: application/json' -H 'X-Requested-With: EduTube' \
  -d '{"email":"enseignant@education.sn","password":"…"}'

# Catalogue : vidéos de 3e en mathématiques, les plus vues
curl 'https://medias.education.sn/api/v1/media?type=VIDEO&classe=3E&discipline=MATHS&tri=populaire'

# Proposition avec fichier
curl -b cj -X POST https://medias.education.sn/api/v1/submissions -H 'X-Requested-With: EduTube' \
  -F type=VIDEO -F 'title=Équations du premier degré (4e)' -F 'description=…' \
  -F cycleId=… -F classLevelId=… -F disciplineId=… -F themeId=… -F file=@cours.mp4
```
