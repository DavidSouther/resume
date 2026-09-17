#!/usr/bin/env zsh
# Spins up a throwaway Postgres in Docker, loads the corrected schema + fuzz data, then runs
# EXPLAIN (ANALYZE, BUFFERS) for each homework query TWICE against the same seeded data --
# once with the candidate indexes, once with them dropped -- so the two passes are a fair
# comparison (no reseeding noise between them). Writes plain data: a CSV of timings and a
# PERF_REPORT.html of tables, Mermaid plan diagrams, and raw EXPLAIN JSON. No prose/interpretation
# is generated here by design -- read the report and draw your own conclusions; re-running costs
# docker time, not LLM tokens.
#
# Docker lifecycle and schema/index migrations live here; query loading, query running, and
# report writing live in perf_scan.py (run via `uv run`).
#
# Usage:
#   ./run_perf_scan.sh                 # fresh container, both passes, tear down
#   ./run_perf_scan.sh --keep          # leave the container running afterward
#   SCALE=200000 ./run_perf_scan.sh    # override customer count (default 20000)

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
CONTAINER=cisc7510_hw1_pg
IMAGE=postgres:16
DB=cisc7510_hw1
PORT="${PORT:-5433}"
SCALE="${SCALE:-20000}"
KEEP=false
PLANS_DIR="$HERE/plans"
CSV_OUT="${CSV_OUT:-$HERE/perf_results.csv}"
REPORT_OUT="${REPORT_OUT:-$HERE/PERF_REPORT.html}"

for arg in "$@"; do
    case "$arg" in
        --keep) KEEP=true ;;
        *) echo "unknown arg: $arg" >&2; exit 1 ;;
    esac
done

psql_c() {
    docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 "$@"
}

perf_scan() {
    uv run --script "$HERE/perf_scan.py" --port "$PORT" --dbname "$DB" \
        --hw-sql "$HERE/db_hw_1.sql" --plans-dir "$PLANS_DIR" "$@"
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
docker cp "$HERE/create_indexes.sql" "$CONTAINER":/tmp/create_indexes.sql
docker cp "$HERE/drop_indexes.sql" "$CONTAINER":/tmp/drop_indexes.sql

echo "Seeding fuzz data (scale=$SCALE)..."
sed "s/generate_series(1, 20000)/generate_series(1, $SCALE)/" "$HERE/fuzz.sql" > /tmp/fuzz_scaled.sql
docker cp /tmp/fuzz_scaled.sql "$CONTAINER":/tmp/fuzz.sql
time psql_c -f /tmp/fuzz.sql >/tmp/fuzz_load.log

rm -rf "$PLANS_DIR"
mkdir -p "$PLANS_DIR"

echo "Creating indexes and running indexed pass..."
psql_c -f /tmp/create_indexes.sql >/dev/null
perf_scan run-pass indexed > /tmp/pass_indexed.csv

echo "Dropping indexes and running no-index pass..."
psql_c -f /tmp/drop_indexes.sql >/dev/null
perf_scan run-pass noindex > /tmp/pass_noindex.csv

echo "Writing report..."
perf_scan report \
    --indexed-csv /tmp/pass_indexed.csv \
    --noindex-csv /tmp/pass_noindex.csv \
    --create-indexes-sql "$HERE/create_indexes.sql" \
    --scale "$SCALE" \
    --csv-out "$CSV_OUT" \
    --report-out "$REPORT_OUT"

echo
column -s, -t "$CSV_OUT"
