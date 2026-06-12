FROM node:20-alpine AS base
RUN npm install -g pnpm

# ── deps ──────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ── builder ──────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate --schema=../../packages/database/prisma/schema.prisma 2>/dev/null || \
    npx prisma generate 2>/dev/null || true
RUN pnpm build

# ── runner ───────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S sagard && adduser -S sagard -u 1001

COPY --from=builder --chown=sagard:sagard /app/dist ./dist
COPY --from=builder --chown=sagard:sagard /app/node_modules ./node_modules
COPY --from=builder --chown=sagard:sagard /app/package.json ./

USER sagard
EXPOSE 4000
CMD ["node", "dist/main"]
