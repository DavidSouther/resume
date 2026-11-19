-- Reproducible test data (seeded).
-- Empids 1..100: pinned ternary tree (parent of g is (g-2)/3+1), so employee 42 has chain
-- 42 -> 14 -> 5 -> 2 -> 1 and employee 24 is re-parented under 16, giving a common manager
-- of 5 (John Doe) rather than the CEO. Depth-to-rank below puts an SVP (empid 2) on that chain.
-- Empids above 100: manager is a random lower empid, so the hierarchy is acyclic and deep.
select setseed(0.42);

insert into employee (empid, fname, lname, managerid, departmentid, employee_rank)
select
    g,
    (array['Ada','Grace','Alan','Edsger','Barbara','Donald','Margaret','Dennis','Linus','Radia'])[1 + g % 10],
    (array['Hopper','Turing','Lovelace','Knuth','Liskov','Ritchie','Perlman','Hamilton','Dijkstra','Thompson'])[1 + (g / 10) % 10],
    case
        when g = 1 then null
        when g <= 100 then (g - 2) / 3 + 1
        else 1 + floor(random() * (g - 1))::int
    end,
    1 + g % 12,
    'tbd' -- placeholder for the rank update below
from generate_series(1, 20000) as g;

-- Both are ancestors of 42; the path query must stop at the nearer match, empid 5.
update employee set fname = 'John', lname = 'Doe' where empid in (2, 5);
update employee set managerid = 16 where empid = 24;

-- Rank comes from depth after the reparenting above, so this runs last. Depth 6 and deeper are all Engineer.
with recursive depth(empid, d) as (
    select empid, 0 from employee where managerid is null
    union all
    select e.empid, depth.d + 1 from employee e join depth on e.managerid = depth.empid
)
update employee e set employee_rank = (array['CEO','SVP','VP','Director','Manager','Lead','Engineer'])[least(depth.d, 6) + 1]
from depth where depth.empid = e.empid;

-- perf.sql drops and recreates this index by name.
create index employee_managerid_idx on employee (managerid);
analyze employee;
