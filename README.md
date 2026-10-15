# EduTube

Plateforme d’apprentissage : interface React, serveur Node, PostgreSQL et stockage vidéo privé. Les cours, comptes, inscriptions, notes, quiz et progressions passent par le serveur. Les vidéos sont préparées en HLS et stockées dans MinIO.

## Prérequis

- Node.js **22.12+** ou une version LTS plus récente ; Node 20.19+ reste compatible.
- npm, fourni avec Node.
- Docker avec **Compose v2**, démarré.
- Make : macOS ou Linux ; sous Windows, utiliser **WSL2** avec Docker Desktop intégré.

La version recommandée est indiquée dans `.nvmrc` (`nvm use` si vous utilisez nvm).

Le premier lancement nécessite Internet pour les dépendances et les images Docker. Toutes les commandes ci-dessous se lancent à la racine du dépôt.

## Installer et démarrer

```sh
make config     # Créer .env sans écraser votre configuration
make doctor     # Vérifier les outils et Docker
make setup      # Installer, migrer la base et créer les comptes de test
make dev        # Démarrer React, Node et leurs services
```

Pour tout préparer et démarrer en une commande :

```sh
make start
```

Ouvrir **[http://localhost:3082](http://localhost:3082)**. Garder le terminal ouvert. `Ctrl+C` arrête React et Node ; `make stop` arrête les services Docker. Les données sont conservées.

Pour les lancements suivants, **`make dev` suffit**. `make setup` peut être relancé : les migrations appliquées, comptes existants et mots de passe modifiés sont conservés.

## Adresses locales

| Service    | Adresse                                               | Usage                                               |
| ---------- | ----------------------------------------------------- | --------------------------------------------------- |
| EduTube    | [localhost:3082](http://localhost:3082)               | Interface et accès HTTP `/api/v1`                   |
| Node       | [localhost:3083/health](http://localhost:3083/health) | État du serveur et de sa connexion à la base        |
| PostgreSQL | `127.0.0.1:5434`                                      | Base `edutube`, utilisateur `edutube`               |
| Mailpit    | [localhost:8026](http://localhost:8026)               | E-mails de vérification, récupération et invitation |
| MinIO      | [localhost:9041](http://localhost:9041)               | Console du stockage vidéo ; API sur `9040`          |

Les identifiants PostgreSQL et MinIO de développement sont dans `.env`. Ce fichier reste ignoré par Git. Les valeurs fournies sont destinées au développement local.

## Comptes de test

`make setup` crée ces comptes. Leur mot de passe initial commun est **`EduTube-Test2026!`**.

| Adresse                   | Rôle                | Accès principal                                       |
| ------------------------- | ------------------- | ----------------------------------------------------- |
| `eleve@edutube.test`      | Apprenant           | Cours suivis, progression, favoris, notes et quiz     |
| `nouveau@edutube.test`    | Apprenant           | Vérification d’adresse et parcours débutant           |
| `enseignant@edutube.test` | Enseignant          | Création et gestion de ses cours                      |
| `admin@edutube.test`      | Enseignant référent | Gestion des cours qui lui sont confiés                |
| `superadmin@edutube.test` | Super-admin         | Comptes, rôles, modération et journal complet         |
| `regulateur@edutube.test` | Régulateur          | Contrôle des contenus et journal de ses interventions |

L’ancien rôle `ADMIN` correspond à l’enseignant référent, pas au super-admin. Le compte `nouveau` possède une adresse non vérifiée ; consulter Mailpit pour terminer sa vérification. `make demo` ajoute les exemples manquants sans réinitialiser les mots de passe.

## Essayer les vidéos

Avec `make dev` actif, ouvrir un second terminal :

```sh
make videos-demo
```

Cette commande télécharge des extraits de démonstration, crée un cours, dépose les vidéos par HTTP, attend leur préparation puis publie le cours. Elle affiche son adresse et conserve son identifiant dans `data/demo-videos/course.json`. Elle exige `curl` et `unzip` ; FFmpeg est fourni par les dépendances npm. Prévoir quelques minutes au premier lancement.

Utiliser le compte enseignant pour gérer les vidéos et `nouveau@edutube.test` pour essayer le verrouillage par examen. La lecture hors connexion n’est pas implémentée. Voir [le fonctionnement vidéo](docs/VIDEO.md).

## Commandes du quotidien

| Commande              | Effet                                                                         |
| --------------------- | ----------------------------------------------------------------------------- |
| `make help`           | Afficher toutes les commandes                                                 |
| `make config`         | Créer `.env` et `data/resources`, conserver l’existant                        |
| `make doctor`         | Vérifier les outils, Docker et la configuration Compose                       |
| `make setup`          | Installer les dépendances, préparer la base et les comptes de test            |
| `make dev`            | Relancer le développement                                                     |
| `make services`       | Démarrer PostgreSQL, MinIO et Mailpit seulement                               |
| `make migrate`        | Appliquer les nouvelles migrations                                            |
| `make migrate-check`  | Valider les migrations appliquées                                             |
| `make seed`           | Compléter le catalogue d’exemple                                              |
| `make demo`           | Compléter les comptes et données de test                                      |
| `make status`         | Afficher les services Docker                                                  |
| `make logs`           | Suivre les journaux Docker ; React et Node locaux écrivent dans leur terminal |
| `make stop`           | Arrêter les services Docker, sans effacer les données                         |
| `make check`          | Linter, types, tests unitaires, formatage et compilation                      |
| `make integration`    | Tester le serveur avec PostgreSQL                                             |
| `make verify-runtime` | Vérifier les services démarrés et comparer leurs réponses à la base           |
| `make api-spec`       | Régénérer la spécification HTTP                                               |

Pour vérifier les services démarrés, préparer aussi le cours vidéo de démonstration puis lancer :

```sh
TEST_PASSWORD='EduTube-Test2026!' make verify-runtime
```

Utiliser le mot de passe actuel si les comptes ont été modifiés. Les connexions répétées trop vite peuvent déclencher leur limitation de sécurité. Les contrôles sont détaillés dans [le guide serveur](docs/SERVER.md#vérifications).

## Configuration

Modifier **`.env`**, puis redémarrer le projet. Les commandes Make et `npm run dev` le chargent par les mêmes règles. Node valide ses paramètres au démarrage et nomme les réglages invalides sans afficher les secrets. Les variables du terminal priment sur ce fichier. Pour changer temporairement le port du front :

```sh
make dev PORT=3100
```

Si `WEB_ORIGIN` est absent, il suit automatiquement ce port. S’il est renseigné dans votre `.env`, le mettre à jour aussi. Pour accéder depuis une autre machine, renseigner `HOST=0.0.0.0` et `WEB_ORIGIN` avec l’adresse exacte du navigateur.

`DATABASE_URL` est calculé depuis `DB_PORT` et `DB_PASSWORD` quand il n’est pas renseigné. Après modification du port PostgreSQL ou du mot de passe, vérifier qu’un éventuel `DATABASE_URL` explicite correspond toujours. Modifier `DB_PASSWORD` ne change pas le mot de passe d’un volume PostgreSQL déjà initialisé.

Voir [les variables et le dépannage](docs/SERVER.md).

## Tout lancer dans Docker

Alternative au lancement local, avec les mêmes ports : arrêter d’abord React et Node locaux.

```sh
make config
make docker-up
make demo
```

`make demo` nécessite les dépendances npm : lancer `make install` si elles ne sont pas présentes. Les comptes de démonstration sont facultatifs dans ce mode ; le catalogue est chargé automatiquement. `make videos-demo` utilise aussi les dépendances locales.

`make docker-up` applique Flyway, charge le catalogue, construit les images puis démarre Node et le front Nginx. Les migrations ne sont pas rejouées lors d’un simple redémarrage de Node. Les deux images sont définies dans `apps/api/Dockerfile` et `apps/web/Dockerfile`. `make docker-down` retire les conteneurs sans supprimer les volumes. Les identifiants de stockage et les adresses internes des conteneurs sont gérés par Compose. Ce mode reste destiné au développement local ; un hébergement public nécessite sa propre configuration d’exploitation.

## Organisation du code

```text
apps/web/src/          Interface React, logique de présentation et services HTTP
apps/api/src/domain/  Règles métier
apps/api/src/application/  Cas d’usage et interfaces des dépendances
apps/api/src/adapters/     HTTP, PostgreSQL, stockage, sécurité et messagerie
packages/contracts/   Schémas de données et opérations HTTP partagés
db/migrations/        Migrations Flyway ; ne pas modifier une migration appliquée
db/fixtures/          Catalogue d’exemple
scripts/              Lancement et vérification du projet
infra/                Proxy Nginx
```

Les consignes communes et garde-fous des agents sont dans `AGENTS.md` ; `CLAUDE.md` y renvoie.

Les commentaires sont en français. Les noms sont explicites et courts. ESLint, TypeScript et Prettier contrôlent la qualité du code ; `make format` applique le formatage.

Les données persistantes sont dans les volumes Docker `postgres_data`, `minio_data`, `mail_data` et dans `data/resources`. Les fichiers temporaires et les extraits de démonstration restent dans `data/`. Une sauvegarde complète doit inclure la base, les documents et le stockage vidéo.

## Documentation technique

- [Architecture et règles métier](docs/ARCHITECTURE.md)
- [Configuration, vérifications et dépannage](docs/SERVER.md)
- [Modèles et conventions HTTP](docs/API-DESIGN.md)
- [Lecture vidéo et changement de stockage](docs/VIDEO.md)
- [Spécification OpenAPI](docs/openapi.json), générée depuis les contrats
