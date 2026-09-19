-- Corrected schema for db_hw_2.sql (fixes: real types, missing `;`s, no PK on company since
-- a company legitimately spans multiple cities -- needed for Q4 "how many cities is First
-- Bank Corp. located in"). Used by run_perf_scan.sh to stand up a scratch database.

create table employee (
    employee_name text primary key,
    street text,
    city text
);

create table company (
    company_name text,
    city text
);

create table works (
    employee_name text,
    company_name text,
    salary numeric,
    foreign key (employee_name) references employee(employee_name)
);

create table manages (
    employee_name text,
    manager_name text,
    foreign key (employee_name) references employee(employee_name),
    foreign key (manager_name) references employee(employee_name)
);
