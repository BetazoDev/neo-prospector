FROM node:22-slim AS base

# Install openssl and build tools
FROM base AS deps
RUN apt-get update && apt-get install -y openssl python3 make g++ build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json* ./
# Use npm install to properly resolve platform-specific native binaries (better-sqlite3)
RUN npm install

# Rebuild the source code
FROM base AS builder
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set dummy DATABASE_URL for build phase prisma generate
ENV DATABASE_URL="file:./prisma/dev.db"
RUN npx prisma generate
RUN npm run build

# Production image
FROM base AS runner
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data /app/prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrations and start application
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
