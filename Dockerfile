# ---- build stage ----
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# Remove dev dependencies in-place (keeps .prisma and @prisma/client intact)
RUN npm prune --omit=dev

# ---- production stage ----
FROM node:20-slim AS production
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

RUN groupadd -r appgroup && useradd -r -g appgroup appuser \
  && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000
CMD ["node", "dist/src/main"]
