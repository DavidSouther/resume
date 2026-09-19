-- Fuzz-data generator for db_hw_2.sql (Postgres syntax; adjust types for other engines)
-- Run against a scratch database, e.g.:
--   createdb cisc7510_hw2
--   psql cisc7510_hw2 -f schema.sql
--   psql cisc7510_hw2 -f fuzz.sql

-- 1. Companies. 'company' has no key of its own (a company can span multiple cities), so
-- seed a mix of single-city and multi-city companies. 'First Bank Corp.' is pinned to three
-- cities (Q4). 'CitiBank' is pinned to New York plus one other city (Q5).
insert into company (company_name, city)
values
    ('First Bank Corp.', 'New York'),
    ('First Bank Corp.', 'Newark'),
    ('First Bank Corp.', 'Stamford'),
    ('CitiBank', 'New York'),
    ('CitiBank', 'Chicago'),
    ('Exactly75Corp', 'Boston');

insert into company (company_name, city)
select 'Company ' || g, case (g % 4)
    when 0 then 'New York'
    when 1 then 'Newark'
    when 2 then 'Stamford'
    else 'Chicago'
end
from generate_series(1, 60) as g;

-- 2. Employees, ~15000 of them, addressed across the same cities as the companies.
insert into employee (employee_name, street, city)
select
    'Employee ' || g,
    g || ' Fuzz St',
    case (g % 4)
        when 0 then 'New York'
        when 1 then 'Newark'
        when 2 then 'Stamford'
        else 'Chicago'
    end
from generate_series(1, 15000) as g;

-- Guarantee a couple of named employees the sample questions reference.
insert into employee (employee_name, street, city) values
    ('John Doe', '1 Fuzz St', 'New York'),
    ('Jane Manager', '2 Fuzz St', 'New York');

-- 3. Works: assign every employee to exactly one company, with a lognormal-ish salary spread
-- so outlier/percentile/skew queries have real tails. 'Exactly75Corp' gets pinned to exactly
-- 75 employees (Q3); 'CitiBank' gets a guaranteed New-York-based headcount (Q5).
with distinct_companies as (
    select distinct company_name from company where company_name not in ('Exactly75Corp', 'CitiBank')
),
numbered_companies as (
    select company_name, row_number() over () as n, count(*) over () as total
    from distinct_companies
),
all_employees as (
    select employee_name, row_number() over (order by employee_name) as n
    from employee
    where employee_name not in ('John Doe', 'Jane Manager')
),
-- last 75 non-pinned employees go to Exactly75Corp, next 40 go to CitiBank, the rest are
-- spread round-robin across the remaining companies.
sized as (
    select
        e.employee_name,
        case
            when e.n <= 75 then 'Exactly75Corp'
            when e.n <= 115 then 'CitiBank'
            else nc.company_name
        end as company_name
    from all_employees as e
    left join numbered_companies as nc
        on nc.n = ((e.n - 116) % nc.total) + 1
)
insert into works (employee_name, company_name, salary)
select
    employee_name,
    company_name,
    round((40000 + (random() ^ 2) * 300000)::numeric, 2)
from sized
union all
values
    ('John Doe', 'CitiBank', 95000),
    ('Jane Manager', 'CitiBank', 180000);

-- 4. Manages: within each company, the first employee (by name) manages the rest, and John
-- Doe reports to Jane Manager so the sample lookup queries have an answer.
insert into manages (employee_name, manager_name)
select w.employee_name, m.manager_name
from works as w
join (
    select distinct on (company_name) company_name, employee_name as manager_name
    from works
    order by company_name, employee_name
) as m on m.company_name = w.company_name
where w.employee_name <> m.manager_name
  and w.employee_name not in ('John Doe', 'Jane Manager');

insert into manages (employee_name, manager_name) values ('John Doe', 'Jane Manager');

analyze employee;
analyze company;
analyze works;
analyze manages;

-- The runner itself (spin up Postgres, load schema + fuzz data, run every query currently
-- filled into db_hw_2.sql under EXPLAIN ANALYZE, write a report) lives in run_perf_scan.sh /
-- perf_scan.py, mirroring hw1. Queries in db_hw_2.sql that are still blank are skipped, not
-- answered here.
