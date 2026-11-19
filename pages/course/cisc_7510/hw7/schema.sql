-- Data assumption, not enforced here: managerid is NULL only for the CEO, the single root of an acyclic hierarchy.
create table employee (
    empid integer primary key,
    fname text not null,
    lname text not null,
    managerid integer references employee(empid),
    departmentid integer,
    employee_rank text not null
);

-- The upward chain includes the starting employee at level 0.
create function employee_ancestors(start_empid integer)
returns table (empid integer, fname text, lname text, managerid integer, employee_rank text, lvl integer)
language sql stable as $$
    with recursive up as (
        select e.empid, e.fname, e.lname, e.managerid, e.employee_rank, 0 as lvl
        from employee e where e.empid = start_empid
        union all
        select m.empid, m.fname, m.lname, m.managerid, m.employee_rank, up.lvl + 1
        from up join employee m on m.empid = up.managerid
    )
    select * from up;
$$;

-- Direct reports begin at level 1; the starting employee is excluded.
create function employee_reports(start_empid integer)
returns table (empid integer, fname text, lname text, lvl integer)
language sql stable as $$
    with recursive reports as (
        select e.empid, e.fname, e.lname, 1 as lvl
        from employee e where e.managerid = start_empid
        union all
        select e.empid, e.fname, e.lname, reports.lvl + 1
        from employee e join reports on e.managerid = reports.empid
    )
    select * from reports;
$$;
