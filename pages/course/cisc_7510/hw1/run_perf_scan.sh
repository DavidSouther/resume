#!/usr/bin/env zsh
# Spins up a throwaway Postgres in Docker, loads the corrected schema + fuzz data, then runs
# EXPLAIN (ANALYZE, BUFFERS) for each homework query TWICE against the same seeded data --
# once with the candidate indexes, once with them dropped -- so the two passes are a fair
# comparison (no reseeding noise between them). Writes plain data: a CSV of timings and a
# PERF_REPORT.md of tables + raw EXPLAIN plans. No prose/interpretation is generated here by
# design -- read the report and draw your own conclusions; re-running costs docker time, not
# LLM tokens.
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
REPORT_OUT="${REPORT_OUT:-$HERE/PERF_REPORT.md}"

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
docker cp "$HERE/db_hw_1_schema.sql" "$CONTAINER":/tmp/schema.sql
psql_c -f /tmp/schema.sql >/dev/null

echo "Seeding fuzz data (scale=$SCALE)..."
sed "s/generate_series(1, 20000)/generate_series(1, $SCALE)/" "$HERE/db_hw_1_fuzz.sql" > /tmp/fuzz_scaled.sql
docker cp /tmp/fuzz_scaled.sql "$CONTAINER":/tmp/fuzz.sql
time psql_c -f /tmp/fuzz.sql >/tmp/fuzz_load.log

ROW_COUNTS="$(psql_c -t -A -F',' -c "select 'product', count(*) from product
           union all select 'customer', count(*) from customer
           union all select 'purchase', count(*) from purchase
           union all select 'purchase_items', count(*) from purchase_items;")"
echo "Row counts:"
echo "$ROW_COUNTS" | column -s, -t

# --- Indexes under test -------------------------------------------------------------------
declare -A INDEXES
INDEXES[idx_purchase_customerid]="purchase (customerid)"
INDEXES[idx_purchase_items_purchaseid]="purchase_items (purchaseid)"
INDEXES[idx_purchase_items_productid]="purchase_items (productid)"
INDEXES[idx_customer_zip]="customer (zip)"
INDEXES[idx_customer_state]="customer (state)"
INDEXES[idx_purchase_timestamp]="purchase (purchasetimestamp)"

create_indexes() {
    for idx in "${(k)INDEXES[@]}"; do
        psql_c -c "create index if not exists $idx on ${INDEXES[$idx]};" >/dev/null
    done
    psql_c -c "analyze;" >/dev/null
}

drop_indexes() {
    for idx in "${(k)INDEXES[@]}"; do
        psql_c -c "drop index if exists $idx;" >/dev/null
    done
    psql_c -c "analyze;" >/dev/null
}

# --- Queries under test (Q1-Q15 from db_hw_1.sql) -----------------------------------------
declare -A QUERIES
QUERIES[q01_product_description]="select p.description from product as p where p.productid = 42;"
QUERIES[q02_customer_name_address]="select c.name, c.address from customer as c where c.customerId = 42;"
QUERIES[q03_products_by_customer]="select pi.productid from purchase_items as pi left join purchase as p on pi.purchaseid = p.purchaseid left join customer as c on c.customerid = p.customerId where c.customerId = 42;"
QUERIES[q04_customers_by_product]="select c.customerid from customer as c left join purchase as p on c.customerid = p.customerid left join purchase_items as pi on p.purchaseid = pi.purchaseid where pi.productid = 24;"
QUERIES[q05_never_purchased_customers]="select c.name from customer as c left join purchase as p on p.customerid = c.customerid where p.purchaseid is null;"
QUERIES[q06_never_purchased_products]="select p.description from product as p left join purchase_items as pi on p.productid = pi.productid where pi.productid is null;"
QUERIES[q07_products_by_zip]="select unique(pi.productid) from purchase_items as pi left join purchase as p on pi.purchaseid = p.purchaseid left join customer as c on c.customerid = p.customerid where c.zip = '10001';"
QUERIES[q08_pct_purchased_42]="with purchase_42 as (select distinct c.customerid from customer as c join purchase as p on c.customerid = p.customerid join purchase_items as pi on p.purchaseid = pi.purchaseid where pi.productid = 42) select 100.0 * count(distinct p42.customerid) / count(distinct c.customerid) as pct from customer as c left join purchase_42 as p42 on p42.customerid = c.customerid;"
QUERIES[q09_pct_42_also_24]="with purchased_42 as (select distinct p.customerid from purchase as p join purchase_items as pi on pi.purchaseid = p.purchaseid where pi.productid = 42), purchased_24 as (select distinct p.customerid from purchase as p join purchase_items as pi on pi.purchaseid = p.purchaseid where pi.productid = 24) select 100.0 * count(distinct p24.customerid) / count(distinct p42.customerid) as pct from purchased_42 as p42 left join purchased_24 as p24 on p24.customerid = p42.customerid;"
QUERIES[q10_most_popular_ny]="select pi.productid, count(*) as purchases from purchase_items as pi join purchase as p on p.purchaseid = pi.purchaseid join customer as c on c.customerid = p.customerid where c.state = 'NY' group by pi.productid order by purchases desc limit 1;"
QUERIES[q11_most_popular_tristate]="select pi.productid, count(*) as purchases from purchase_items as pi join purchase as p on p.purchaseid = pi.purchaseid join customer as c on c.customerid = p.customerid where c.state in ('NJ', 'NY', 'CT') group by pi.productid order by purchases desc limit 1;"
QUERIES[q12_bought_24_before_20200704]="select distinct c.customerid, c.name from customer as c join purchase as p on p.customerid = c.customerid join purchase_items as pi on pi.purchaseid = p.purchaseid where pi.productid = 24 and p.purchasetimestamp < '2020-07-04';"
QUERIES[q13_last_purchase_products]="with last_purchase as (select customerid, max(purchasetimestamp) as last_ts from purchase group by customerid) select c.customerid, pi.productid from customer as c join last_purchase as lp on lp.customerid = c.customerid join purchase as p on p.customerid = c.customerid and p.purchasetimestamp = lp.last_ts join purchase_items as pi on pi.purchaseid = p.purchaseid;"
QUERIES[q14_last_10_purchases_products]="with ranked_purchases as (select purchaseid, customerid, purchasetimestamp, row_number() over (partition by customerid order by purchasetimestamp desc) as rn from purchase) select c.customerid, pi.productid, rp.purchasetimestamp from customer as c join ranked_purchases as rp on rp.customerid = c.customerid and rp.rn <= 10 join purchase_items as pi on pi.purchaseid = rp.purchaseid;"
QUERIES[q15_names_bought_42_last_3mo]="select distinct c.name from customer as c join purchase as p on p.customerid = c.customerid join purchase_items as pi on pi.purchaseid = p.purchaseid where pi.productid = 42 and p.purchasetimestamp >= current_date - interval '3 months';"

# The homework question each query answers (see db_hw_1.sql), repeated at the top of every
# plan file so the file is self-contained without cross-referencing another document.
declare -A QUESTIONS
QUESTIONS[q01_product_description]="What is the description of productid=42?"
QUESTIONS[q02_customer_name_address]="What's the name and address of customerid=42?"
QUESTIONS[q03_products_by_customer]="What products did customerid=42 purchase?"
QUESTIONS[q04_customers_by_product]="List customers who bought productid=24?"
QUESTIONS[q05_never_purchased_customers]="List customer names who have never puchased anything."
QUESTIONS[q06_never_purchased_products]="List product descriptions who have never been purchased by anyone."
QUESTIONS[q07_products_by_zip]="What products were purchased by customers with zip code 10001?"
QUESTIONS[q08_pct_purchased_42]="What percentage of customers have ever purchased productid=42?"
QUESTIONS[q09_pct_42_also_24]="Of customers who purchased productid=42, what percentage also purchased productid=24?"
QUESTIONS[q10_most_popular_ny]="What is the most popular (purchased most often) product in NY state?"
QUESTIONS[q11_most_popular_tristate]="What is the most popular (purchased most often) product in Tri-state Area? (NJ, NY, CT)"
QUESTIONS[q12_bought_24_before_20200704]="Who purchased productid=24 prior to July 4th, 2020?"
QUESTIONS[q13_last_purchase_products]="For each customer, find all products from their last purchase."
QUESTIONS[q14_last_10_purchases_products]="For each customer, find all products from their last 10 purchases."
QUESTIONS[q15_names_bought_42_last_3mo]="Names of customers who have purchased product 42 in the last 3 months."

# run_pass NAME  ->  populates plans/<query>_<NAME>.txt and prints "<query>,<planning_ms>,<exec_ms>" per line to stdout
run_pass() {
    local pass_name="$1"
    for name in "${(k)QUERIES[@]}"; do
        echo "  [$pass_name] $name..." >&2
        # A single query failing (e.g. Q7's syntax error, or a divide-by-zero on an empty
        # result set) must not abort the whole scan under `set -e`.
        set +e
        plan="$(psql_c -c "explain (analyze, buffers, format text) ${QUERIES[$name]}" 2>&1)"
        set -e
        {
            echo "-- Question: ${QUESTIONS[$name]}"
            echo "-- Query:"
            echo "${QUERIES[$name]}"
            echo
            echo "$plan"
        } > "$PLANS_DIR/${name}_${pass_name}.txt"
        plan_ms="$(echo "$plan" | sed -nE 's/^[[:space:]]*Planning Time: ([0-9.]+).*/\1/p')"
        exec_ms="$(echo "$plan" | sed -nE 's/^[[:space:]]*Execution Time: ([0-9.]+).*/\1/p')"
        [ -z "$plan_ms" ] && plan_ms="ERROR"
        [ -z "$exec_ms" ] && exec_ms="ERROR"
        echo "$name,$plan_ms,$exec_ms"
    done
}

rm -rf "$PLANS_DIR"
mkdir -p "$PLANS_DIR"

echo "Creating indexes and running indexed pass..."
create_indexes
run_pass indexed | sort > /tmp/pass_indexed.csv

echo "Dropping indexes and running no-index pass..."
drop_indexes
run_pass noindex | sort > /tmp/pass_noindex.csv

# --- Combine into perf_results.csv: query,indexed_planning_ms,indexed_execution_ms,noindex_planning_ms,noindex_execution_ms,speedup
echo "query,indexed_planning_ms,indexed_execution_ms,noindex_planning_ms,noindex_execution_ms,speedup" > "$CSV_OUT"
join -t, -j1 /tmp/pass_indexed.csv /tmp/pass_noindex.csv | awk -F, '
{
    query=$1; ip=$2; ie=$3; np=$4; ne=$5;
    speedup = "n/a";
    if (ie ~ /^[0-9.]+$/ && ne ~ /^[0-9.]+$/ && ie+0 > 0) {
        speedup = sprintf("%.1fx", ne/ie);
    }
    printf "%s,%s,%s,%s,%s,%s\n", query, ip, ie, np, ne, speedup;
}' >> "$CSV_OUT"

echo "Row counts and index/query definitions for the report..."
INDEX_DEFS="$(for idx in "${(k)INDEXES[@]}"; do echo "- \`$idx\` on \`${INDEXES[$idx]}\`"; done | sort)"

# --- Generate PERF_REPORT.md: tables + raw plans, no interpretation ------------------------
{
    echo "# db_hw_1 perf scan results"
    echo
    echo "Auto-generated by \`run_perf_scan.sh\` -- regenerate with \`./run_perf_scan.sh\`."
    echo "Do not hand-edit; the next run overwrites this file."
    echo
    echo "- Scale: $SCALE customers (see \`db_hw_1_fuzz.sql\`)"
    echo "- Row counts:"
    echo
    echo '```'
    echo "$ROW_COUNTS" | column -s, -t
    echo '```'
    echo
    echo "- Candidate indexes (created for the \`indexed\` pass, dropped for \`noindex\`, same seeded data both times):"
    echo
    echo "$INDEX_DEFS"
    echo
    echo "## Timings"
    echo
    echo "| query | indexed exec (ms) | no-index exec (ms) | speedup |"
    echo "|---|---:|---:|---:|"
    tail -n +2 "$CSV_OUT" | awk -F, '{printf "| %s | %s | %s | %s |\n", $1, $3, $5, $6}'
    echo
    echo "Raw data: \`perf_results.csv\`. Full \`EXPLAIN (ANALYZE, BUFFERS)\` output for every"
    echo "query, both passes: \`plans/<query>_indexed.txt\` / \`plans/<query>_noindex.txt\`."
    echo
    echo "## Plans"
    echo
    for name in $(tail -n +2 "$CSV_OUT" | cut -d, -f1 | sort); do
        echo "<details><summary><code>$name</code></summary>"
        echo
        echo "Indexed:"
        echo '```'
        cat "$PLANS_DIR/${name}_indexed.txt"
        echo '```'
        echo
        echo "No index:"
        echo '```'
        cat "$PLANS_DIR/${name}_noindex.txt"
        echo '```'
        echo
        echo "</details>"
        echo
    done
} > "$REPORT_OUT"

PLAN_COUNT="$(ls -1 "$PLANS_DIR" | wc -l | tr -d ' ')"
echo
echo "Wrote $CSV_OUT, $REPORT_OUT, and $PLAN_COUNT plan files in $PLANS_DIR."
column -s, -t "$CSV_OUT"
