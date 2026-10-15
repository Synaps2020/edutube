FROM node:22-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN npm ci --omit=dev
COPY apps/api ./apps/api
COPY packages/contracts ./packages/contracts
COPY db ./db
COPY scripts ./scripts
RUN mkdir -p /app/data/resources && chown -R node:node /app/data
USER node
EXPOSE 3083
CMD ["node", "--import", "tsx", "apps/api/src/main.ts"]
