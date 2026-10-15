VACUUM ANALYZE;
SELECT c.relname AS table,
       c.reltuples::bigint AS approx_rows,
       pg_relation_size(c.oid) AS heap_bytes,
       pg_size_pretty(pg_relation_size(c.oid)) AS heap,
       pg_size_pretty(pg_indexes_size(c.oid)) AS indexes,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname;
SELECT pg_size_pretty(pg_database_size('cts')) AS database_size;
