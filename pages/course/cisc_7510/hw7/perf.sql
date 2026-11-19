-- Downward recursion joins employee.managerid = r.empid on every iteration, so it needs an
-- index on managerid. Upward recursion walks empid, which the primary key already covers.
-- The index is dropped for one comparison and recreated at the end (created in fuzz.sql).
\echo === upward managers of 42
explain (analyze, costs off, timing off, summary on)
select empid, fname, lname from employee_ancestors(42) where lvl > 0;
\echo === downward reports of 42, WITH managerid index
explain (analyze, costs off, timing off, summary on)
select count(*) from employee_reports(42);
\echo === downward reports of 42, WITHOUT managerid index
drop index employee_managerid_idx;
explain (analyze, costs off, timing off, summary on)
select count(*) from employee_reports(42);
create index employee_managerid_idx on employee (managerid);
