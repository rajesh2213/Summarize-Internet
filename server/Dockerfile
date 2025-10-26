FROM node:20-alpine AS base

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

FROM base AS development
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --only=development
COPY server/ .
EXPOSE 4000
CMD ["npm", "run", "dev"]

FROM base AS builder
WORKDIR /app
COPY server/package*.json ./

RUN npm cache clean --force
RUN npm ci --include=dev

COPY server/prisma ./prisma

RUN npx prisma generate --schema=./prisma/schema.prisma

RUN npm prune --production && npm cache clean --force

FROM base AS production
WORKDIR /app

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/generated ./generated
COPY --chown=nodejs:nodejs server/ .

RUN mkdir -p logs && chown nodejs:nodejs logs

COPY server/scripts/start.sh ./start.sh
RUN chmod +x ./start.sh

USER nodejs

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

EXPOSE 4000
CMD ["./start.sh"]
