-- Fuzz-data generator + perf scan for db_hw_1.sql (Postgres syntax; adjust types for other engines)
-- Run against a scratch database, e.g.:
--   createdb cisc7510_hw1
--   psql cisc7510_hw1 -f db_hw_1_schema.sql      -- corrected schema (fix the trailing commas/types first)
--   psql cisc7510_hw1 -f db_hw_1_fuzz.sql

-- 1. Seed reference tables
insert into product (description, listprice)
select 'product ' || g, round((random() * 500 + 1)::numeric, 2)
from generate_series(1, 1000) as g;

insert into customer (username, name, address, city, state, zip)
select
    'user' || g,
    'Customer ' || g,
    g || ' Fuzz St',
    -- weight toward NY/NJ/CT so tri-state queries have real rows to find
    case (g % 5)
        when 0 then 'New York'
        when 1 then 'Newark'
        when 2 then 'Stamford'
        else 'Anytown'
    end,
    case (g % 5)
        when 0 then 'NY'
        when 1 then 'NJ'
        when 2 then 'CT'
        else 'TX'
    end,
    case (g % 5)
        when 0 then lpad((10001 + (random() * 4924)::int)::text, 5, '0')  -- NY
        when 1 then lpad((7001  + (random() * 1988)::int)::text, 5, '0') -- NJ
        when 2 then lpad((6001  + (random() * 927)::int)::text, 5, '0')  -- CT
        else lpad((20000 + (random() * 79999)::int)::text, 5, '0')       -- elsewhere
    end
from generate_series(1, 20000) as g;

-- 2. Seed purchases, skewed so ~15% of customers never buy (needed for Q5/Q6 to have output)
-- NB: a generate_series bound like `(random() * 5)::int` is NOT evaluated per row, even under
-- LATERAL, unless it actually references the outer row -- Postgres is free to (and did, in
-- testing) evaluate it once and hand every customer the same fixed count. Filtering a
-- fixed-size cross join with `where random() < p` instead is unambiguous: the WHERE clause is
-- evaluated once per candidate row, so each slot is kept or dropped independently.
insert into purchase (purchasetimestamp, customerid)
select
    now() - (random() * interval '730 days'),
    c.customerid
from customer as c
cross join generate_series(1, 4) as g(n) -- up to 4 purchase slots per eligible customer
where c.customerid % 100 >= 15           -- ~15% of customers are excluded entirely (never buy)
  and random() < 0.6;                    -- each slot kept independently -> 0-4 purchases, avg ~2.4

-- 3. Seed purchase_items. Every purchase gets a guaranteed first item, plus 0-4 more kept
-- independently, so purchases end up with 1-5 line items (never 0). productid=42/24 are
-- boosted so the hot-path queries (Q8, Q9, Q15) have real rows to find.
insert into purchase_items (itemid, purchaseid, productid, quantity, price)
select
    row_number() over (order by x.purchaseid, x.n),
    x.purchaseid,
    case when random() < 0.1 then 42
         when random() < 0.2 then 24
         else (1 + (random() * 999)::int)
    end,
    (1 + (random() * 4)::int),
    round((random() * 500 + 1)::numeric, 2)
from (
    select p.purchaseid, 1 as n from purchase as p -- guaranteed first item
    union all
    select p.purchaseid, g.n
    from purchase as p
    cross join generate_series(2, 5) as g(n) -- up to 4 more slots
    where random() < 0.5                     -- each slot kept independently
) as x;

analyze product;
analyze customer;
analyze purchase;
analyze purchase_items;

-- Index creation/teardown and the perf scan itself live in run_perf_scan.sh, which runs each
-- of Q1-Q15 under EXPLAIN (ANALYZE, BUFFERS) both with and without the candidate indexes
-- against this same seeded data, and writes the results to PERF_REPORT.md.
