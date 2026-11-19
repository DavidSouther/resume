-- Who (empid, fname, lname) is the immediate manager of employee 42?
select m.empid, m.fname, m.lname from employee e join employee m on m.empid = e.managerid where e.empid = 42;

-- Who (empid, fname, lname) reports directly to employee 42?
select empid, fname, lname from employee where managerid = 42;

-- Who (empid, fname, lname) reports (directly or indirectly) to employee 42?
select empid, fname, lname from employee_reports(42);

-- Count of all employees who report to employee 42?
select count(*) from employee_reports(42);

-- Who does employee 42 report to (directly or indirectly)?
select empid, fname, lname from employee_ancestors(42) where lvl > 0;

-- Who is employee 42's most immediate SVP manager?
select empid, fname, lname from employee_ancestors(42) where lvl > 0 and employee_rank = 'SVP' order by lvl limit 1;

-- How many levels up is employee 42's most immediate SVP manager?
select lvl from employee_ancestors(42) where lvl > 0 and employee_rank = 'SVP' order by lvl limit 1;

-- How many levels away is employee 42 from the CEO?
-- (Root is identified by employee_rank = 'CEO'. Employee 42 has one upward chain, so one CEO row is reachable.)
select lvl from employee_ancestors(42) where employee_rank = 'CEO';

-- Maximum number of employee levels reporting to employee 42?
-- (max() over zero rows is NULL, so coalesce returns 0 for an employee with no reports.)
select coalesce(max(lvl), 0) from employee_reports(42);

-- For employee 42, find the path of managers directly to the CEO?
select lvl, empid, fname, lname from employee_ancestors(42) where lvl > 0 order by lvl;

-- For employee 42, find the path of managers directly to the nearest manager named John Doe?
with up as (select * from employee_ancestors(42) where lvl > 0)
select lvl, empid, fname, lname from up where lvl <= (select lvl from up where fname = 'John' and lname = 'Doe' order by lvl limit 1) order by lvl;

-- Employees 42 and 24, most immediate common manager?
-- (Each chain includes the employee, so a manager of the other employee is the common manager.)
select a.empid, a.fname, a.lname from employee_ancestors(42) a join employee_ancestors(24) b on a.empid = b.empid order by a.lvl + b.lvl limit 1;

-- Employee 42 sends employee 24 a message up to the common manager, then down. What is the path (empid, fname, lname)?
-- (seq counts 0..l42 going up from 42; the down leg continues at l42+1 by walking 24's chain from the common manager back toward 24.)
with up42 as (select * from employee_ancestors(42)),
up24 as (select * from employee_ancestors(24)),
common as (
    select a.empid, a.lvl as l42, b.lvl as l24 from up42 a join up24 b on a.empid = b.empid order by a.lvl + b.lvl limit 1
), hops as (
    select a.lvl as seq, a.empid from up42 a, common c where a.lvl <= c.l42
    union all
    select c.l42 + (c.l24 - b.lvl) as seq, b.empid from up24 b, common c where b.lvl < c.l24
)
select h.seq, e.empid, e.fname, e.lname from hops h join employee e on e.empid = h.empid order by h.seq;
