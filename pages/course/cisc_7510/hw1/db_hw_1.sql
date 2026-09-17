-- 1. What is the description of productid=42?
select p.description from product as p where p.productid = 42;

-- 2. What's the name and address of customerid=42?
select c.name, c.address from customer as c where c.customerId = 42;

-- 3. What products did customerid=42 purchase?
select pi.productid from purchase_items as pi left join purchase as p on pi.purchaseid = p.purchaseid left join customer as c on c.customerid = p.customerId where c.customerId = 42;

-- 4. List customers who bought productid=24?
select c.customerid from customer as c left join purchase as p on c.customerid = p.customerid left join purchase_items as pi on p.purchaseid = pi.purchaseid where pi.productid = 24;

-- 5. List customer names who have never puchased anything.
select c.name
from customer as c
left join purchase as p on p.customerid = c.customerid
where p.purchaseid is null;

-- 6. List product descriptions who have never been purchased by anyone.
select p.description from product as p left join purchase_items as pi on p.productid = pi.productid where pi.productid is null;

-- 7. What products were purchased by customers with zip code 10001?
select distinct pi.productid from purchase_items as pi left join purchase as p on pi.purchaseid = p.purchaseid left join customer as c on c.customerid = p.customerid where c.zip = '10001';

-- 8. What percentage of customers have ever purchased productid=42?
with purchase_42 as (
    select distinct c.customerid
    from customer as c
    join purchase as p on c.customerid = p.customerid
    join purchase_items as pi on p.purchaseid = pi.purchaseid
    where pi.productid = 42
)
select 100.0 * count(distinct p42.customerid) / count(distinct c.customerid) as pct
from customer as c
left join purchase_42 as p42 on p42.customerid = c.customerid;

-- 9. Of customers who purchased productid=42, what percentage also purchased productid=24?
with
purchased_42 as (
    select distinct p.customerid from purchase as p join purchase_items as pi on pi.purchaseid = p.purchaseid where pi.productid = 42
),
purchased_24 as (
    select distinct p.customerid from purchase as p join purchase_items as pi on pi.purchaseid = p.purchaseid where pi.productid = 24
)
select 100.0 * count(distinct p24.customerid) / count(distinct p42.customerid) as pct
from purchased_42 as p42 left join purchased_24 as p24 on p24.customerid = p42.customerid;

-- 10. What is the most popular (purchased most often) product in NY state?
select pi.productid, count(*) as purchases
from purchase_items as pi
join purchase as p on p.purchaseid = pi.purchaseid
join customer as c on c.customerid = p.customerid
where c.state = 'NY'
group by pi.productid
order by purchases desc
limit 1;

-- 11. What is the most popular (purchased most often) product in Tri-state Area? (NJ, NY, CT)
select pi.productid, count(*) as purchases
from purchase_items as pi
join purchase as p on p.purchaseid = pi.purchaseid
join customer as c on c.customerid = p.customerid
where c.state in ('NJ', 'NY', 'CT')
group by pi.productid
order by purchases desc
limit 1;

-- 12. Who purchased productid=24 prior to July 4th, 2020?
select distinct c.customerid, c.name
from customer as c
join purchase as p on p.customerid = c.customerid
join purchase_items as pi on pi.purchaseid = p.purchaseid
where pi.productid = 24 and p.purchasetimestamp < '2020-07-04';

-- 13. For each customer, find all products from their last purchase.
with last_purchase as (
    select customerid, max(purchasetimestamp) as last_ts
    from purchase
    group by customerid
)
select c.customerid, pi.productid
from customer as c
join last_purchase as lp on lp.customerid = c.customerid
join purchase as p on p.customerid = c.customerid and p.purchasetimestamp = lp.last_ts
join purchase_items as pi on pi.purchaseid = p.purchaseid;

-- 14. For each customer, find all products from their last 10 purchases.
with ranked_purchases as (
    select purchaseid, customerid, purchasetimestamp,
           row_number() over (partition by customerid order by purchasetimestamp desc) as rn
    from purchase
)
select c.customerid, pi.productid, rp.purchasetimestamp
from customer as c
join ranked_purchases as rp on rp.customerid = c.customerid and rp.rn <= 10
join purchase_items as pi on pi.purchaseid = rp.purchaseid;

-- 15. Names of customers who have purchased product 42 in the last 3 months.
select distinct c.name
from customer as c
join purchase as p on p.customerid = c.customerid
join purchase_items as pi on pi.purchaseid = p.purchaseid
where pi.productid = 42
  and p.purchasetimestamp >= current_date - interval '3 months';
