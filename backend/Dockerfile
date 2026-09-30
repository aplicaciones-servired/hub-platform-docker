FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY tsconfig.json ./
COPY drizzle.config.json ./
COPY src/ ./src/
COPY drizzle/ ./drizzle/
RUN npm run build

FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS prod

WORKDIR /app

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs && apk add --no-cache postgresql-client

COPY package*.json ./
RUN npm ci --legacy-peer-deps && npm prune --omit=dev && chown -R nodejs:nodejs /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY drizzle.config.json ./
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY scripts/migrate-and-seed.sh /migrate-and-seed.sh
COPY scripts/gc-uploads.sh /gc-uploads.sh

RUN chown -R nodejs:nodejs /app && chmod +x /docker-entrypoint.sh /migrate-and-seed.sh /gc-uploads.sh

# Instalar cron semanal de GC uploads (domingos 03:15) como root antes de cambiar de usuario
RUN mkdir -p /etc/cron.d && echo "15 3 * * 0 root DATABASE_URL=\${DATABASE_URL} UPLOAD_DIR=/app/uploads /gc-uploads.sh >> /var/log/gc-uploads.log 2>&1" > /etc/cron.d/gc-uploads && chmod 644 /etc/cron.d/gc-uploads

USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=10s --start-period=45s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3001/api/health',r=>{process.exit(r.statusCode===200?0:1)})"

ENTRYPOINT ["/docker-entrypoint.sh"]
