#!/usr/bin/env zsh
# Spins up a throwaway Postgres in Docker, loads the corrected schema + fuzz data, then runs
# every query currently filled into db_hw_2.sql and reports whether it ran without erroring
# and how many rows it returned. No perf/EXPLAIN measurement -- this is just "does it run and
# return sane data", not a benchmark.
#
# Usage:
#   ./run_queries.sh                 # fresh container, run, tear down
#   ./run_queries.sh --keep          # leave the container running afterward
#   SCALE=50000 ./run_queries.sh     # override employee count (default 15000)

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
CONTAINER=cisc7510_hw2_pg
IMAGE=postgres:16
DB=cisc7510_hw2
PORT="${PORT:-5434}"
SCALE="${SCALE:-15000}"
KEEP=false

for arg in "$@"; do
    case "$arg" in
        --keep) KEEP=true ;;
        *) echo "unknown arg: $arg" >&2; exit 1 ;;
    esac
done

psql_c() {
    docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 "$@"
}

cleanup() {
    if [ "$KEEP" = false ]; then
        docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    else
        echo "Container '$CONTAINER' left running on port $PORT (docker rm -f $CONTAINER to remove)."
    fi
}
trap cleanup EXIT

echo "Starting Postgres container..."
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB="$DB" \
    -p "$PORT":5432 \
    "$IMAGE" >/dev/null

echo -n "Waiting for Postgres to accept connections"
until docker exec "$CONTAINER" pg_isready -U postgres -d "$DB" >/dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo " ready."

echo "Loading schema..."
docker cp "$HERE/schema.sql" "$CONTAINER":/tmp/schema.sql
psql_c -f /tmp/schema.sql >/dev/null

echo "Seeding fuzz data (scale=$SCALE)..."
sed "s/generate_series(1, 15000)/generate_series(1, $SCALE)/" "$HERE/fuzz.sql" > /tmp/fuzz_scaled.sql
docker cp /tmp/fuzz_scaled.sql "$CONTAINER":/tmp/fuzz.sql
psql_c -f /tmp/fuzz.sql >/tmp/fuzz_load.log

echo "Running queries..."
uv run --script "$HERE/verify_queries.py" --port "$PORT" --dbname "$DB" --hw-sql "$HERE/db_hw_2.sql"
