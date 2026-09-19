-- Find 'John Doe's Manager's Name.
select manager_name from manages where employee_name = 'John Doe'; 

-- Find employees whom 'John Doe' manages.
select employee_name from manages where manager_name = 'John Doe';

-- Find all companies that have exactly 75 employees.
with employee_count as (
    select count(employee_name) as employee_count, company_name
    from works group by company_name
)
select company_name from employee_count where employee_count = 75;

-- Find in how many cities is 'First Bank Corp.' located.
select count(distinct city) from company where company_name = 'First Bank Corp.';

-- Find how many employees work for 'CitiBank' in New York.
with ny as (
    select * from employee where city = 'New York'
)
select count(*) from ny left join works on ny.employee_name = works.employee_name where company_name = 'CitiBank';

-- Find the company with most employees.
with counts as (
    select company_name, count(*) as employee_count from works group by company_name
)
select company_name from counts order by employee_count desc limit 1;

-- Find employees who make more than the average salary within their company.
with avgs as (
    select company_name, avg(salary) as avg_salary from works group by company_name
)
select w.employee_name from works w join avgs a on a.company_name = w.company_name
where w.salary > a.avg_salary;

-- Find employees who make more than the median salary within their company.
with totals as (
    select company_name, count(*) as total from works group by company_name
),
ranked as (
    select w.employee_name, w.company_name, w.salary,
           (select count(*) from works w2
            where w2.company_name = w.company_name and w2.salary <= w.salary) as num_at_or_below
    from works w
),
medians as (
    select r.company_name, min(r.salary) as median_salary
    from ranked r join totals t on t.company_name = r.company_name
    where r.num_at_or_below >= t.total / 2 + 1
    group by r.company_name
)
select w.employee_name from works w join medians m on m.company_name = w.company_name
where w.salary > m.median_salary;

-- Find employees whose salary is an outlier (above 2 standard deviations) within their comapny.
with stats as (
    select company_name, avg(salary) as avg_salary, stddev(salary) as stddev_salary
    from works group by company_name
)
select w.employee_name from works w join stats s on s.company_name = w.company_name
where w.salary > s.avg_salary + 2 * s.stddev_salary;

-- Find employees whose salary is an outlier (above 95th percentile) within their comapny.
with totals as (
    select company_name, count(*) as total from works group by company_name
),
ranked as (
    select w.employee_name, w.company_name, w.salary,
           (select count(*) from works w2
            where w2.company_name = w.company_name and w2.salary <= w.salary) as num_at_or_below
    from works w
),
p95 as (
    select r.company_name, min(r.salary) as p95_salary
    from ranked r join totals t on t.company_name = r.company_name
    where r.num_at_or_below >= t.total * 0.95
    group by r.company_name
)
select w.employee_name from works w join p95 on p95.company_name = w.company_name
where w.salary > p95.p95_salary;

-- Find the company with the highest number of outlying salaries (your choice which outlier to use).
with stats as (
    select company_name, avg(salary) as avg_salary, stddev(salary) as stddev_salary
    from works group by company_name
),
outliers as (
    select w.company_name from works w join stats s on s.company_name = w.company_name
    where w.salary > s.avg_salary + 2 * s.stddev_salary
)
select company_name from outliers group by company_name order by count(*) desc limit 1;

-- Find the company with most non-managing employees.
with non_managers as (
    select company_name, employee_name from works
    where employee_name not in (select manager_name from manages)
)
select company_name from non_managers group by company_name order by count(*) desc limit 1;

-- Find the company with highest average difference between manager salary and non-manager employee salary.
with manager_salaries as (
    select m.employee_name, wm.salary as manager_salary
    from manages m join works wm on wm.employee_name = m.manager_name
)
select w.company_name, avg(ms.manager_salary - w.salary) as avg_diff
from works w join manager_salaries ms on ms.employee_name = w.employee_name
group by w.company_name
order by avg_diff desc
limit 1;

-- Assume that each non-managing employee genererates around 2x their salary in revenue. Managing employees don't directly contribute to revenue. Estimate revenue and ``profit'' for each company (assume profit = revenue - all_salaries).
create or replace view company_profit as (
    with non_managers as (
        select company_name, salary from works
        where employee_name not in (select manager_name from manages)
    ),
    revenue as (
        select company_name, sum(salary * 2) as revenue from non_managers group by company_name
    ),
    total_salaries as (
        select company_name, sum(salary) as all_salaries from works group by company_name
    )
    select r.company_name, r.revenue, r.revenue - t.all_salaries as profit
    from revenue r join total_salaries t on t.company_name = r.company_name
);

select company_name, revenue, profit from company_profit;

-- Calculate salary skew for profitable (profit > 0) companies from question 9.
-- https://blog.jooq.org/calculate-percentiles-to-learn-about-data-set-skew-in-sql/ suggests percentile_disc (discrete percentiles),
-- https://www.postgresql.org/docs/current/functions-aggregate.html#FUNCTIONS-ORDERED-SET-TABLE  has percentile_cont (continuous percentiles),
-- and Bowley percentile skew from https://www.statisticshowto.com/bowley-skewness/
with quartiles as (
    select company_name,
           percentile_disc(0.25) within group (order by salary) as q1,
           percentile_disc(0.5) within group (order by salary) as q2,
           percentile_disc(0.75) within group (order by salary) as q3
    from works
    group by company_name
)
select q.company_name,
       case when q.q3 = q.q1 then 0
            else (q.q3 + q.q1 - 2 * q.q2)::numeric / (q.q3 - q.q1)
       end as salary_skew
from quartiles q
join company_profit p on p.company_name = q.company_name
where p.profit > 0;