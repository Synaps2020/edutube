# Guide de développement serveur

Pour installer et démarrer, suivre d’abord le [README](../README.md). Ce guide précise la configuration, les contrôles et les opérations courantes.

## Configuration commune

`make config` copie `.env.example` vers `.env` uniquement si ce fichier n’existe pas. Il prépare aussi `data/resources`. Il ne remplace aucun accès existant.

`scripts/project.mjs` charge `.env` pour les commandes Make. Les variables déjà présentes dans le terminal priment. Les adresses locales sont calculées lorsqu’elles ne sont pas renseignées :

| Variable                                                               | Valeur locale ou rôle                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `HOST`, `PORT`                                                         | Front sur `127.0.0.1:3082`                                                            |
| `API_HOST`, `API_PORT`                                                 | Node sur `127.0.0.1:3083` en lancement local                                          |
| `DB_PORT`, `DB_PASSWORD`                                               | PostgreSQL local sur `5434`, mot de passe de développement                            |
| `DATABASE_URL`                                                         | Construite depuis les paramètres PostgreSQL locaux ; explicite pour une base distante |
| `WEB_ORIGIN`                                                           | `http://localhost:PORT` si absente ; adresse exacte du navigateur                     |
| `STORAGE_DIR`                                                          | Documents privés, `data/resources` depuis la racine du dépôt                          |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`                                  | Serveur SMTP local et expéditeur                                                      |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_REQUIRE_TLS`                       | Accès SMTP externes si configurés                                                     |
| `VIDEO_STORAGE`                                                        | Fournisseur des nouvelles vidéos, `minio` par défaut                                  |
| `MINIO_ENDPOINT`                                                       | Adresse locale calculée depuis `MINIO_PORT`, `9040` par défaut                        |
| `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_REGION` | Connexion au stockage S3 privé                                                        |
| `WEBDAV_URL`, `WEBDAV_USER`, `WEBDAV_PASSWORD`, `WEBDAV_TOKEN`         | Accès facultatif à un stockage WebDAV                                                 |
| `FFMPEG_PATH`, `FFPROBE_PATH`                                          | Remplacer les exécutables locaux fournis par npm                                      |
| `TEST_PASSWORD`, `TEST_ORIGIN`                                         | Comptes de démonstration et adresse pour la vérification des services démarrés        |

Dans Docker, Compose utilise les adresses internes des services : PostgreSQL sur `postgres:5432`, stockage sur `minio:9000`, SMTP sur `mailpit:1025` et API sur `api:3083`. Les ports publiés sur l’hôte restent ceux de `.env`, sauf le port Node Docker fixé à `3083`. Les paramètres `DATABASE_URL` et `MINIO_ENDPOINT` explicites concernent le lancement local ; adapter Compose pour un fournisseur distant dans le mode Docker.

Les fichiers de documents sont partagés avec `./data/resources`. Si `STORAGE_DIR` change, adapter aussi le montage Docker. `make docker-up` utilise l’utilisateur local pour éviter que les fichiers soient créés avec un propriétaire incompatible.

## Vérifications

```sh
make check            # Code, types, tests unitaires, formatage et compilation
make integration      # Tests contre PostgreSQL, migrations appliquées au préalable
make migrate-check    # Validation Flyway des migrations déjà appliquées
```

Les tests d’intégration ajoutent puis retirent leurs propres données. Les tests administratifs utilisent un schéma isolé. Aucun test ne vide globalement les tables.

Avec le projet démarré, les comptes de test et le cours vidéo de démonstration :

```sh
TEST_PASSWORD='EduTube-Test2026!' make verify-runtime
```

Ce contrôle passe par l’adresse du front et son proxy. Il compare le catalogue, les profils et inscriptions à PostgreSQL ; vérifie les rôles, le CSRF, la fermeture des sessions, les migrations et plusieurs règles de cohérence ; puis lit un manifeste HLS et une plage de segment depuis le stockage réel.

Un favori temporaire du compte `nouveau` vérifie l’écriture HTTP, sa présence en base et sa relecture ; il est retiré à la fin. Les consultations et refus administratifs restent normalement inscrits au journal. La vérification exige les six comptes de démonstration avec le mot de passe fourni. Respecter le délai de limitation des connexions avant une nouvelle exécution rapprochée.

Les tests vidéo d’intégration utilisent un stockage simulé. Les tests WebDAV vérifient le contrat HTTP, pas une installation ownCloud réelle. Aucun test de charge ni certification d’exploitation n’est inclus.

## Base de données

```sh
make migrate          # Ajouter les nouvelles migrations
make migrate-check    # Vérifier les versions et empreintes appliquées
make seed             # Compléter le catalogue
make demo             # Compléter les comptes et leur apprentissage
```

Flyway conserve l’historique en base. Une migration appliquée ne doit pas être modifiée : ajouter un nouveau fichier `V<n>__description.sql`. Les données d’exemple ne remplacent pas les comptes ni leurs mots de passe existants. Les scripts de comptes et vidéos de démonstration refusent un environnement `NODE_ENV=production`.

Les modifications du mot de passe dans `.env` ne modifient pas un volume PostgreSQL existant. Adapter le rôle PostgreSQL par une opération de maintenance puis mettre à jour la configuration correspondante.

## Messagerie et profils

Mailpit reçoit les e-mails locaux sur le port SMTP `1026` ; les consulter sur [localhost:8026](http://localhost:8026). Les liens de vérification expirent après 24 heures, les liens de récupération après 30 minutes. Ils sont à usage unique. Réinitialiser un mot de passe ferme les anciennes sessions.

Les e-mails attendent dans `mail_outbox`. Le serveur réessaie les échecs SMTP ; leur contenu est effacé de la file après livraison. Les messages reçus restent dans le volume Mailpit. Pour un fournisseur externe, configurer ses accès et TLS ; dans Docker, mettre également à jour `SMTP_DOCKER_HOST` et `SMTP_DOCKER_PORT`.

## Maintenance des rôles

L’inscription publique crée un apprenant. Pour initialiser le premier super-admin :

```sh
make account-role EMAIL=responsable@example.com ROLE=SUPER_ADMIN REASON="Initialisation du premier responsable"
```

Dès qu’un super-admin existe, utiliser la console ou préciser l’auteur de maintenance :

```sh
make account-role EMAIL=enseignant@example.com ROLE=TEACHER ACTOR=responsable@example.com REASON="Attribution du rôle enseignant"
make course-owner COURSE=thales EMAIL=enseignant@example.com
```

Ces interventions sont journalisées. Les modifications de rôle révoquent les sessions du compte concerné. La console protège le dernier super-admin actif et interdit la suspension ou la rétrogradation de son propre compte.

Les suppressions de cours sont logiques et réversibles. La restauration remet le cours en brouillon. Le journal administratif conserve les états avant/après, sans mots de passe ni jetons ; les droits d’exploitation sur le schéma PostgreSQL doivent rester limités.

## Conservation des données

| Emplacement            | Données                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| Volume `postgres_data` | Métier, comptes, droits, progression, file de préparation et journaux |
| Volume `minio_data`    | Sources et fichiers vidéo privés                                      |
| Volume `mail_data`     | Courriels reçus par Mailpit                                           |
| `data/resources`       | Documents pédagogiques privés                                         |
| `data/demo-videos`     | Extraits et identifiant du cours de démonstration                     |

`make stop` et `make docker-down` conservent les données. Une sauvegarde complète doit couvrir PostgreSQL, les documents et le stockage vidéo. Le retrait d’un document ou d’une vidéo conserve son fichier privé ; la purge et la rétention restent à définir avant une exploitation durable.

## Dépannage

| Symptôme                                           | Vérification                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Docker inaccessible                                | Démarrer Docker Desktop ou le service Docker, puis `make doctor`                                                    |
| Port occupé                                        | `make status`, puis arrêter l’ancien lancement ou changer le port ; modes local et Docker utilisent les mêmes ports |
| Catalogue indisponible                             | Vérifier le terminal Node, `/health`, puis `make migrate` et `make seed`                                            |
| Origine refusée                                    | Faire correspondre `WEB_ORIGIN` à l’adresse exacte du navigateur ; redémarrer Node                                  |
| Connexion PostgreSQL refusée                       | Comparer `DATABASE_URL`, `DB_PORT` et le mot de passe du volume existant                                            |
| E-mail absent                                      | Vérifier Mailpit et les paramètres SMTP ; consulter les journaux Node                                               |
| Vidéo en échec                                     | Vérifier MinIO, les exécutables FFmpeg/ffprobe et le message dans l’espace enseignant                               |
| Vidéo protégée inaccessible                        | Vérifier inscription, publication et réussite de la révision actuelle du quiz                                       |
| Tests d’intégration absents avec `npm test`        | Utiliser `make integration` ; sans `DATABASE_URL`, les tests PostgreSQL sont ignorés par npm                        |
| Fichiers inaccessibles après un changement de mode | Vérifier le propriétaire et le montage de `data/resources`                                                          |

Les journaux React et Node locaux apparaissent dans le terminal de `make dev`. `make logs` concerne les conteneurs uniquement. `make preview` affiche le front compilé sur `4082` ; les écritures nécessitent un serveur Node configuré avec cette origine. Pour vérifier l’ensemble compilé avec son proxy, privilégier `make docker-up`.
