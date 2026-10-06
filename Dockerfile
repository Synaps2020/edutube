# syntax=docker/dockerfile:1.6
# Image unique pour l'application web (Next.js) et le worker FFmpeg (commande différente).
# Étapes : deps → build (standalone) → runtime minimal avec ffmpeg.

FROM node:20-bookworm-slim AS base
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# --- Dépendances -------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm install --include=dev && npx prisma generate

# --- Build -------------------------------------------------------------------
FROM deps AS build
COPY . .
# Variables factices pour le build (la connexion base n'est pas requise à la compilation)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    JWT_SECRET="build-time-secret-not-used-at-runtime-0123456789abcdef"
RUN npm run build

# --- Exécution ---------------------------------------------------------------
FROM base AS runner
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl tini && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 1001 edu && useradd -u 1001 -g edu -m edu

# Sortie standalone de Next.js (serveur + node_modules minimal)
COPY --from=build --chown=edu:edu /app/.next/standalone ./
COPY --from=build --chown=edu:edu /app/.next/static ./.next/static
COPY --from=build --chown=edu:edu /app/public ./public
# Prisma (CLI + client généré) pour les migrations/seed, worker et ses dépendances
COPY --from=build --chown=edu:edu /app/node_modules ./node_modules
COPY --from=build --chown=edu:edu /app/prisma ./prisma
COPY --from=build --chown=edu:edu /app/worker ./worker
COPY --from=build --chown=edu:edu /app/package.json ./package.json
COPY --from=build --chown=edu:edu /app/tsconfig.json ./tsconfig.json

RUN mkdir -p /data/media && chown -R edu:edu /data
USER edu
ENV PORT=3000 HOSTNAME=0.0.0.0 MEDIA_ROOT=/data/media
EXPOSE 3000
VOLUME ["/data/media"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD curl -fsS http://localhost:3000/api/v1/health || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
# Par défaut : serveur web. Le worker utilise : node node_modules/tsx/dist/cli.mjs worker/index.ts
CMD ["node", "server.js"]
