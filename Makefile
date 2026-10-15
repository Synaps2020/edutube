.DEFAULT_GOAL := help
NPM ?= npm
RUN := node scripts/project.mjs run

# Les options passées à Make priment sur le fichier .env.
ifneq ($(origin HOST),undefined)
export HOST
endif
ifneq ($(origin PORT),undefined)
export PORT
endif
ifneq ($(origin WEB_ORIGIN),undefined)
export WEB_ORIGIN
endif
ifneq ($(origin API_PORT),undefined)
export API_PORT
endif

.PHONY: help config doctor install setup start dev services db-up migrate migrate-check seed demo videos-demo status logs stop docker-up docker-down docker-build build preview typecheck test integration verify-runtime lint format check api-spec account-role course-owner

help: ## Afficher les commandes disponibles
	@awk 'BEGIN {FS = ":.*## "; print "EduTube — commandes disponibles\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

config: ## Créer .env et le dossier de fichiers sans écraser l’existant
	node scripts/project.mjs config

doctor: ## Vérifier Node, npm, Docker, Compose et la configuration
	node scripts/project.mjs doctor

install: doctor ## Installer les dépendances verrouillées
	$(RUN) $(NPM) ci

setup: config ## Préparer le développement : dépendances, base et comptes de test
	$(MAKE) install
	$(MAKE) db-up
	$(MAKE) demo

start: setup ## Préparer le projet puis démarrer React et Node
	$(RUN) $(NPM) run dev

dev: config ## Démarrer les services puis React et Node, dépendances déjà installées
	$(MAKE) db-up
	$(RUN) $(NPM) run dev

services: config ## Démarrer PostgreSQL, MinIO et Mailpit
	$(RUN) docker compose up -d --wait postgres minio mailpit

db-up: migrate ## Préparer la base et charger le catalogue d’exemple
	$(MAKE) seed

migrate: services ## Appliquer les migrations Flyway
	$(RUN) docker compose run --rm migrate

migrate-check: services ## Valider les migrations déjà appliquées
	$(RUN) docker compose run --rm migrate validate

seed: ## Charger le catalogue sans écraser les données existantes
	$(RUN) docker compose run --no-deps --build --rm seed

demo: ## Créer les six comptes de test et leurs données sans les réinitialiser
	$(RUN) $(NPM) run seed:demo --workspace @edutube/api

videos-demo: ## Ajouter le cours vidéo de test ; le serveur doit être démarré
	$(RUN) $(NPM) run seed:videos --workspace @edutube/api

status: ## Afficher l’état des services Docker
	$(RUN) docker compose ps

logs: ## Suivre les journaux Docker (Ctrl+C pour quitter)
	$(RUN) docker compose logs --tail=100 -f

stop: ## Arrêter les services Docker sans effacer leurs données
	$(RUN) docker compose stop

docker-up: config ## Construire et démarrer tout le projet dans Docker
	APP_UID=$$(id -u) APP_GID=$$(id -g) $(RUN) docker compose up --build -d --wait

docker-down: ## Retirer les conteneurs Docker en conservant les données
	$(RUN) docker compose down

docker-build: ## Construire les images du front et du serveur
	$(RUN) docker compose build web api

build: ## Vérifier Node et compiler React
	$(RUN) $(NPM) run build

preview: ## Servir le front compilé sur 4082 ; démarrer Node séparément
	$(MAKE) build
	$(RUN) $(NPM) run preview --workspace @edutube/web -- --host 127.0.0.1 --port 4082 --strictPort

typecheck: ## Vérifier les types TypeScript
	$(RUN) $(NPM) run typecheck

test: ## Exécuter les tests unitaires sans PostgreSQL
	$(RUN) $(NPM) run test:unit

integration: migrate ## Tester les contrats et écritures avec PostgreSQL
	$(RUN) $(NPM) run test:integration

verify-runtime: ## Contrôler les services démarrés avec les comptes de test
	$(RUN) $(NPM) run verify:runtime

lint: ## Vérifier les règles de qualité et de lisibilité
	$(RUN) $(NPM) run lint

format: ## Formater les sources et la documentation
	$(RUN) $(NPM) run format

check: ## Vérifier qualité, types, tests unitaires, formatage et compilation
	$(MAKE) lint
	$(MAKE) typecheck
	$(MAKE) test
	$(RUN) $(NPM) run format:check
	$(MAKE) build

api-spec: ## Régénérer la spécification HTTP depuis les contrats
	$(RUN) $(NPM) run api:spec

account-role: ## Attribuer un rôle avec EMAIL, ROLE, ACTOR et REASON
	$(RUN) $(NPM) run account:role --workspace @edutube/api -- "$(EMAIL)" "$(ROLE)" "$(ACTOR)" "$(REASON)"

course-owner: ## Confier un cours avec COURSE et EMAIL
	$(RUN) $(NPM) run course:owner --workspace @edutube/api -- "$(COURSE)" "$(EMAIL)"
