# Barmaksan · Bilgi Kütüphanesi — tek konteyner: API + React derlemesi.

FROM node:24-bookworm-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM node:24-bookworm-slim AS deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
# better-sqlite3, sharp ve canvas hazır ikili taşır; derleme betiği gerekmez.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
 && node -e "require('better-sqlite3')(':memory:'); require('sharp'); require('@napi-rs/canvas'); console.log('native ok')"

FROM node:24-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data \
    WEB_DIST=/app/web/dist
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY --from=web /app/web/dist ./web/dist
COPY assets/ ./assets/
COPY docs/brief/SCS-2-kontrol-elegi.pdf ./docs/brief/SCS-2-kontrol-elegi.pdf
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server/src/index.js"]
