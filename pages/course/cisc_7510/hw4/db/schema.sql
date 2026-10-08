CREATE TABLE cts (
  tdate  date NOT NULL,
  symbol text NOT NULL,
  open   numeric,
  high   numeric,
  low    numeric,
  close  numeric,
  volume bigint
);
CREATE TABLE splits (
  tdate  date NOT NULL,
  symbol text NOT NULL,
  post   integer,
  pre    integer
);
CREATE TABLE dividend (
  tdate    date NOT NULL,
  symbol   text NOT NULL,
  dividend numeric
);
