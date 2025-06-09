#!/bin/sh
set -e

echo "[ENTRYPOINT] Running initial migration..."
npm run prisma:generate # generate the prisma client 
npm run prisma:migrate:dev --name init --accept-data-loss # migrate the db to latest state
npx prisma db seed

exec npm run start:dev