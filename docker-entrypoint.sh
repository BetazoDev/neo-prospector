#!/bin/sh
set -e

echo "[entrypoint] Syncing Prisma schema with PostgreSQL database..."
if [ -n "$DATABASE_URL" ]; then
  npx prisma db push --accept-data-loss || echo "[entrypoint] Warning: Prisma schema push failed, continuing to start server..."
fi

echo "[entrypoint] Starting Next.js production server on port 3000..."
exec npm run start -- -p 3000 -H 0.0.0.0
