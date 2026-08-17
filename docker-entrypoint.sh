#!/bin/sh
echo "[entrypoint] Starting Next.js production server on port 3000..."

# Run DB schema push in background so boot never fails or blocks
if [ -n "$DATABASE_URL" ]; then
  (npx prisma db push --accept-data-loss || true) &
fi

exec npm run start
