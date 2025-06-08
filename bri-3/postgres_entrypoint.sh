#!/bin/sh
set -e

echo "[ENTRYPOINT] Checking if any tables exist..."

TABLE_COUNT=$(psql "$DATABASE_URL" -t -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" \
  2>/dev/null | tr -d '[:space:]')

if [ "$TABLE_COUNT" -gt 0 ]; then
  echo "[ENTRYPOINT] Found $TABLE_COUNT tables. Running migrate reset..."
  npx prisma migrate reset --force --skip-seed
else
  echo "[ENTRYPOINT] No tables found. Running initial migration..."
  npm run prisma:generate # generate the prisma client 
  npm run prisma:migrate:dev --name init --accept-data-loss # migrate the db to latest state
  npx prisma db seed
fi

exec npm run start:dev