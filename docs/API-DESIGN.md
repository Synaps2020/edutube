# Modèles et conventions HTTP

## Sources de référence

| Sujet                  | Source                                     |
| ---------------------- | ------------------------------------------ |
| Opérations et chemins  | `packages/contracts/src/operations.ts`     |
| Schémas communs        | `packages/contracts/src/index.ts`          |
| Profil et récupération | `packages/contracts/src/identity.ts`       |
| Gestion des cours      | `packages/contracts/src/teaching.ts`       |
| Documents              | `packages/contracts/src/resources.ts`      |
| Vidéos et verrous      | `packages/contracts/src/videos.ts`         |
| Administration         | `packages/contracts/src/administration.ts` |
| Modèle persistant      | `db/migrations/`                           |
| Spécification générée  | [openapi.json](openapi.json)               |

Les opérations de la spécification sont implémentées par le serveur. Lancer `make api-spec` pour régénérer ce fichier après modification des contrats. Modifier les sources, pas le JSON généré.

## Conventions

L’API utilise le préfixe **`/api/v1`**. Vite en développement et Nginx dans Docker transmettent ce préfixe à Node. Le front utilise le même transport pour le JSON, les formulaires de fichiers et les téléchargements.

Une réponse JSON réussie contient `{ "data": ... }`. Une erreur contient `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`. Une suppression peut répondre sans corps. Les téléchargements et segments vidéo renvoient directement leurs octets.

Les collections utilisent `items` et `pagination` : `page`, `pageSize`, `total` et `totalPages`. Il faut demander toutes les pages nécessaires, pas seulement filtrer la première dans le navigateur. Les tris et filtres acceptés sont définis par les schémas de l’opération.

| Code HTTP     | Sens                                      |
| ------------- | ----------------------------------------- |
| `200` / `201` | Lecture, modification ou création réussie |
| `202`         | Vidéo acceptée, préparation en attente    |
| `204`         | Réussite sans corps                       |
| `206`         | Plage d’octets transmise                  |
| `400`         | Données invalides                         |
| `401`         | Session absente ou expirée                |
| `403`         | Accès, origine ou protection CSRF refusés |
| `404`         | Ressource introuvable ou masquée          |
| `409`         | Conflit de révision ou de demande rejouée |
| `413`         | Fichier trop volumineux                   |
| `416`         | Plage d’octets impossible                 |
| `429`         | Demandes trop rapprochées                 |

## Modèles

Un résumé de cours contient les informations d’une carte, pas toutes les leçons. Une fiche de cours contient sa présentation et son programme. Le contenu d’un chapitre est demandé à son ouverture. Les corrections restent dans les contrats privés enseignants et ne sont révélées à l’apprenant qu’après soumission.

Les DTO décrivent les échanges. Les adaptateurs du front les convertissent en modèles de vue : nom de l’enseignant, texte de durée, progression ou illustration. Les DTO ne contiennent ni JSX ni classes CSS.

| Ensemble    | Relations                                                                           |
| ----------- | ----------------------------------------------------------------------------------- |
| Catalogue   | Un cours référence une matière et un enseignant ; ses chapitres ont un ordre unique |
| Parcours    | Des étapes ordonnées référencent des cours existants                                |
| Compte      | Un profil, des sessions et des jetons limités dans le temps                         |
| Inscription | Un compte et un cours ; une seule inscription pour cette paire                      |
| Progression | Des chapitres terminés liés à une inscription et au bon cours                       |
| Note        | Un texte et une version par compte et chapitre                                      |
| Quiz        | Un quiz par cours, des questions ordonnées, des tentatives par compte               |
| Documents   | Métadonnées liées au chapitre ; fichier privé identifié par une clé opaque          |
| Vidéo       | Métadonnées, fournisseur de stockage, état et fichiers HLS                          |
| Journal     | Auteur, action, cible, date et états utiles sans secrets                            |

## Authentification et écritures

`GET /auth/session` renvoie le compte, l’expiration et le jeton CSRF. Le cookie porte la session ; aucun mot de passe ou jeton de session n’est enregistré dans `localStorage`.

Les écritures authentifiées envoient le jeton CSRF et respectent l’origine autorisée. Les opérations de création rejouables utilisent `Idempotency-Key` lorsqu’il est demandé par le contrat : la même demande rend le même résultat ; un contenu différent avec la même clé est refusé.

Les mises à jour de profil utilisent `expectedVersion`. Les cours et interventions administratives utilisent `expectedRevision`. Un conflit exige de relire la donnée avant de choisir une nouvelle modification.

Les routes `/me` utilisent le compte connecté. Le navigateur ne soumet ni score calculé, ni date de validation, ni pourcentage de progression faisant autorité. Les corrections et accès aux chapitres sont décidés par le serveur.

## Groupes de routes

| Préfixe                                    | Usage                                                                |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `/auth`                                    | Connexion, inscription, déconnexion, vérification et récupération    |
| `/taxonomy`, `/courses`, `/learning-paths` | Catalogue, programme, chapitres et quiz publics autorisés            |
| `/me`                                      | Profil et apprentissage du compte connecté                           |
| `/teaching/courses`                        | Gestion des cours du propriétaire, documents et vidéos               |
| `/resources`                               | Téléchargement autorisé des documents                                |
| `/administration`                          | Tableau de bord, comptes, modération, journal et lecture de contrôle |

Les détails de chaque chemin, paramètres et réponses se trouvent dans OpenAPI. Les contrôles d’accès s’appliquent également aux fichiers : un verrou d’examen ou un retrait de cours ne se contourne pas en conservant l’URL d’un segment.
