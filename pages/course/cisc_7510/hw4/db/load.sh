#!/bin/sh
# Run from hw4/. Starts Postgres in docker and loads ctsdata.20140211 files.
# Database files persist on the host in ./pgdata, so later runs reuse loaded data.
set -e
mkdir -p "$PWD/pgdata"
if docker ps -a --format '{{.Names}}' | grep -qx cts-pg; then
  docker start cts-pg >/dev/null
else
  docker run -d --name cts-pg -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=cts \
    -v "$PWD/data:/data:ro" -v "$PWD/db:/db:ro" -v "$PWD/pgdata:/var/lib/postgresql/data" \
    -p 5433:5432 postgres:16
fi
until docker exec cts-pg pg_isready -U postgres -d cts >/dev/null 2>&1; do sleep 1; done
sleep 3
PSQL="docker exec -i cts-pg psql -U postgres -d cts -v ON_ERROR_STOP=1"
if [ "$($PSQL -tAc "SELECT to_regclass('public.cts') IS NOT NULL")" = "t" ]; then
  echo "Tables already loaded in ./pgdata; skipping load."
else
  $PSQL -f /db/schema.sql
  $PSQL -c "\copy cts      FROM '/data/cts.dump.csv'       WITH (FORMAT csv)"
  $PSQL -c "\copy splits   FROM '/data/splits.dump.csv'    WITH (FORMAT csv)"
  $PSQL -c "\copy dividend FROM '/data/dividends.dump.csv' WITH (FORMAT csv)"
fi
$PSQL -f /db/space.sql
