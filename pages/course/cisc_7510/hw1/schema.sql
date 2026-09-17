-- Corrected schema for db_hw_1.sql (fixes: real types, no trailing commas, missing `;`s,
-- serial declared on its own). Used by run_perf_scan.sh to stand up a scratch database.

create table product (
    productid serial primary key,
    description varchar,
    listprice float
);

create table customer (
    customerid serial primary key,
    username varchar,
    name varchar,
    address varchar,
    city varchar,
    state varchar,
    zip varchar
);

create table purchase (
    purchaseid serial primary key,
    purchasetimestamp timestamp with time zone,
    customerid int,
    foreign key (customerid) references customer(customerid)
);

create table purchase_items (
    itemid int,
    purchaseid int,
    productid int,
    quantity float,
    price float,
    foreign key (purchaseid) references purchase(purchaseid),
    foreign key (productid) references product(productid)
);
