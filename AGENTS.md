# Consignes du projet EduTube

## Stack et organisation

Le projet utilise React avec Vite, Fastify sur Node.js, PostgreSQL avec Flyway et un stockage vidéo privé MinIO ou WebDAV. Il n’utilise pas Next.js.

- `apps/web` : interface et adaptateurs HTTP.
- `apps/api/src/domain` : règles métier, sans dépendance aux outils.
- `apps/api/src/application` : cas d’usage et ports.
- `apps/api/src/adapters` : HTTP, PostgreSQL, stockage et services externes.
- `packages/contracts` : contrats partagés ; `db/migrations` : schéma persistant.
- Lire le README et la référence concernée dans `docs/` avant une modification structurante.

## Garde-fous

- Conserver les données et changements existants. Ne pas vider les volumes, supprimer les comptes, réinitialiser la base ou écraser `.env` pour résoudre un problème de démarrage.
- Ne jamais afficher ni committer les secrets de `.env`, cookies, jetons, clés privées ou liens de récupération. Les identifiants de démonstration documentés restent réservés au développement local.
- Ne pas modifier une migration appliquée. Ajouter une migration numérotée et vérifier sa compatibilité avec les données existantes.
- Les permissions, examens, corrections et calculs de progression font autorité au serveur. Les mêmes droits s’appliquent aux fichiers et aux URL directes.
- Chaque mutation administrative conserve sa trace dans la transaction métier. Ne pas contourner les contrôles de rôle, révision, session, origine ou CSRF.
- Les données métier viennent du serveur. Ne pas masquer une panne par un jeu de démonstration ou un stockage navigateur implicite.
- Les vidéos passent par le port de stockage. Ne pas introduire de SDK fournisseur dans le domaine ou dans React, ni exposer les clés de stockage.
- Préserver la séparation entre brouillon, publication et modération. Une mise à jour concurrente doit être refusée, pas écrasée.

## Configuration et scripts

- Utiliser les commandes Make du README. La configuration locale est chargée par les scripts communs ; les variables du terminal priment sur `.env`.
- Valider les paramètres au démarrage avec un message utile, sans exposer leur valeur sensible. Éviter les valeurs par défaut dupliquées et les réglages dispersés.
- Garder les services internes Docker sur leurs adresses internes. Les ports de l’hôte sont configurables séparément.
- Tout nouveau processus doit gérer ses erreurs et sa fermeture. Un démarrage échoué ne doit pas laisser de traitements ni de connexions ouverts.
- Modifier ensemble `.env.example`, les scripts, Compose et la documentation si une option de lancement change.
- Ne pas ajouter de script destructeur de nettoyage ou de réinitialisation automatique.

## Code et documentation

Écrire les commentaires et la documentation en français, avec des phrases courtes. Commenter une raison ou une contrainte, pas chaque ligne. Garder des noms explicites et courts ; respecter ESLint et les contrats existants.

Ne pas ajouter de rapport de progression, capture de preuve ou archive d’ancien code au dépôt. Maintenir la documentation d’usage existante et régénérer OpenAPI depuis les contrats. Les images réellement utilisées par le produit restent dans ses ressources publiques.

## Vérifications

- `make check` pour les règles de qualité, types, tests unitaires et compilation.
- `make integration` lorsqu’une règle métier, une route, un droit ou un accès PostgreSQL change.
- `make verify-runtime` pour contrôler les services démarrés avec les comptes de test et les vidéos de démonstration.
- `make api-spec` si les contrats HTTP changent.
- Tester les changements de configuration, les échecs de démarrage et les options concernées. Ne pas prétendre avoir testé un mode non exécuté.
- Garder les ressources temporaires de test isolées et les retirer après vérification. Ne pas arrêter les services d’un autre projet.
