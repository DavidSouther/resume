#!/usr/bin/env bash
# Disposable Postgres so verification and perf runs always start from identical state.
#   ./run_queries.sh          # tear the container down afterward
#   ./run_queries.sh --keep   # leave the container running
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER="cisc7510_hw7_pg_$(uuidgen | tr '[:upper:]' '[:lower:]')"
CREATED=false
DB=cisc7510_hw7
KEEP=false
[ "${1:-}" = "--keep" ] && KEEP=true
cleanup() { if [ "$CREATED" = true ] && [ "$KEEP" = false ]; then docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; fi; }
trap cleanup EXIT
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=pw postgres:16 >/dev/null
CREATED=true
[ "$KEEP" = false ] || printf 'Container: %s\n' "$CONTAINER"
# The image's init phase runs a socket-only server before restarting; checking over TCP waits for the real one.
for _ in $(seq 60); do
    docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1 && break
    sleep 1
done
docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U postgres >/dev/null
docker exec "$CONTAINER" createdb -U postgres "$DB"
for f in schema.sql fuzz.sql; do
    docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q <"$HERE/$f" >/dev/null
done
python3 -I "$HERE/verify_queries.py" "$CONTAINER" "$DB"
docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q <"$HERE/perf.sql"
