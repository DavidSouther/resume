# HW7 plan report

Data: 20000 employees, pinned ternary tree for empids 1..100, random lower-id managers above. Postgres 16. Snapshot from one run of `./run_queries.sh`; timings vary by run and machine, so rerun it to regenerate them.

| Query | Plan | Execution |
|---|---|---|
| Upward managers of 42 (`employee_ancestors`) | Primary key lookups | 0.057 ms |
| Count downward reports of 42 (`employee_reports`), with `employee_managerid_idx` | Index Scan on managerid, Nested Loop | 0.481 ms |
| Count downward reports of 42 (`employee_reports`), no index | Seq Scan of 20000 rows on each of 12 recursion iterations, Hash Join | 11.927 ms |

Refinement: downward recursion benefits from an index on `managerid` (about 25x faster here). Upward recursion walks `empid`, so the primary key suffices. The index is created in `fuzz.sql`. Every query in `db_hw_7.sql` matches an independent Python computation (`verify_queries.py`) for five employee pairs, including the CEO, a leaf employee and an ancestor/descendant pair.
