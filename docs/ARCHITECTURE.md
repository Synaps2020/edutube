# Architecture

## Principes

React présente les données. Node applique les règles métier. PostgreSQL conserve les données et les droits. Les documents et vidéos restent dans des stockages privés ; leurs métadonnées sont dans la base.

Le front n’utilise pas de données pédagogiques locales en remplacement d’une erreur du serveur. Les anciens adaptateurs locaux servent aux tests et à l’import explicite des anciennes données d’un compte.

## Séparation des responsabilités

| Dossier                          | Responsabilité                                                                |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `apps/api/src/domain`            | Modèles et règles métier, sans Fastify, PostgreSQL ou fournisseur de stockage |
| `apps/api/src/application`       | Cas d’usage et ports vers les dépendances                                     |
| `apps/api/src/adapters/http`     | Routes, validation, session et traduction des erreurs                         |
| `apps/api/src/adapters/postgres` | Requêtes paramétrées, transactions et contrôle des écritures concurrentes     |
| `apps/api/src/adapters/storage`  | Documents locaux, MinIO/S3 et WebDAV                                          |
| `apps/api/src/adapters/security` | Mots de passe et jetons                                                       |
| `apps/api/src/bootstrap.ts`      | Assemblage des dépendances et gestion de leur fermeture                       |
| `packages/contracts/src`         | Schémas Zod et opérations HTTP partagés                                       |
| `apps/web/src/application`       | Services, ports et coordination des sauvegardes                               |
| `apps/web/src/adapters/http`     | Transport, validation des réponses et conversion vers les vues                |
| `apps/web/src/ui`                | Pages et composants React                                                     |

Un contrôleur HTTP ne contient pas les règles de publication ou de correction. Un composant React ne connaît ni les tables SQL, ni les clés du stockage.

La configuration est validée dans `apps/api/src/config/environment.ts`, puis transmise aux adaptateurs. `main.ts` gère l’écoute et les signaux ; `bootstrap.ts` assemble les composants sans écouter automatiquement. Les scripts partagent un chargeur de configuration et une gestion des groupes de processus. Voir [le guide serveur](SERVER.md#fichiers-de-configuration).

## Domaines métier

| Domaine        | Données et règles                                                       |
| -------------- | ----------------------------------------------------------------------- |
| Catalogue      | Matières, enseignants, cours, chapitres et parcours ordonnés            |
| Identité       | Comptes, profils, rôles, sessions et liens à usage unique               |
| Apprentissage  | Inscriptions, chapitres terminés, reprise, favoris et notes             |
| Évaluation     | Quiz, questions, corrections privées et tentatives corrigées au serveur |
| Enseignement   | Propriété des cours, révisions, brouillons et publication               |
| Médias         | Documents, vidéos, préparation et fichiers de lecture                   |
| Administration | Invitations, suspensions, modération et journal                         |

Les migrations de `db/migrations` définissent le modèle réellement utilisé. Les types de transport ne remplacent pas ces contraintes.

## Règles importantes

- Un cours possède des chapitres ordonnés. Un parcours référence des cours sans recopier leur contenu.
- Les données personnelles appartiennent au compte de la session. Le navigateur ne choisit pas un identifiant d’apprenant pour écrire à sa place.
- Un enseignant modifie uniquement les cours dont il est propriétaire. L’enseignant affiché et le propriétaire du compte peuvent être différents pour un cours confié.
- Modifier un cours publié exige de le remettre en brouillon. Publier exige au moins un chapitre et une vidéo prête pour chaque chapitre vidéo.
- Les écritures sensibles portent une révision attendue. Un conflit renvoie une erreur au lieu d’écraser une autre modification.
- Les notes sont envoyées dans l’ordre. Un brouillon en conflit reste visible jusqu’au choix de l’utilisateur.
- Le score d’un quiz est calculé au serveur. Un chapitre protégé exige une réussite sur la révision actuelle de l’examen ; les fichiers et validations appliquent le même verrou.
- La modération retire un cours des lectures publiques. Une restauration le remet en brouillon sans supprimer la progression.
- Les changements administratifs et leurs traces sont enregistrés dans la même transaction. Le journal refuse les modifications et suppressions ordinaires.

## Rôles

| Rôle          | Périmètre                                                   |
| ------------- | ----------------------------------------------------------- |
| `LEARNER`     | Son apprentissage                                           |
| `TEACHER`     | Ses cours et son apprentissage                              |
| `ADMIN`       | Ancien rôle d’enseignant référent, limité aux cours confiés |
| `REGULATOR`   | Modération des contenus, journal de ses interventions       |
| `SUPER_ADMIN` | Comptes, rôles, suspensions, modération et journal complet  |

L’inscription publique crée un apprenant. Les droits sont relus en base à chaque demande ; changer un rôle ou suspendre un compte invalide ses sessions.

## Sessions et fichiers

Le cookie de session est `HttpOnly`, `SameSite=Lax` et `Secure` lorsque l’origine est HTTPS. La base conserve l’empreinte du jeton. Le jeton CSRF reste en mémoire dans le front. Les mots de passe utilisent scrypt.

Les documents sont transmis par Node depuis un dossier privé. Les vidéos sont lues par segments HLS depuis un port de stockage indépendant du fournisseur. Voir [VIDEO.md](VIDEO.md).

## Ajouter une fonctionnalité

1. Définir le contrat dans `packages/contracts/src` et l’opération HTTP correspondante.
2. Ajouter la règle au domaine et le cas d’usage dans l’application.
3. Implémenter les accès nécessaires dans les adaptateurs ; ajouter une migration si le modèle change.
4. Brancher le service HTTP et ses états de chargement, erreur et réussite dans React.
5. Tester les règles, permissions, conflits et écritures utiles.
6. Lancer `make check`, `make integration` et `make api-spec` si les contrats changent.

Ajouter une migration numérotée après la dernière ; ne jamais modifier une migration déjà appliquée. Les comptes, documents et vidéos d’un autre utilisateur doivent rester inaccessibles même par URL directe.
