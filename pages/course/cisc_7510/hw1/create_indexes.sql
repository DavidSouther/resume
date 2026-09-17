create index if not exists idx_purchase_customerid on purchase (customerid);
create index if not exists idx_purchase_items_purchaseid on purchase_items (purchaseid);
create index if not exists idx_purchase_items_productid on purchase_items (productid);
create index if not exists idx_customer_zip on customer (zip);
create index if not exists idx_customer_state on customer (state);
create index if not exists idx_purchase_timestamp on purchase (purchasetimestamp);
analyze;
