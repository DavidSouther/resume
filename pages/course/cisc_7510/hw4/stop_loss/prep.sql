-- Builds sl_px: split-adjusted daily series with ranking features for liquid symbols, 1993 on.
-- Prices o, c and dividend d are in current-share units (split factor f = product of pre/post for later splits).
-- ok excludes dash-suffixed symbols (London listings, preferreds, other series) and index or foreign-quoted symbols found by inspection (zero dividends and splits, price levels in the thousands), which are not tradable US shares.
-- Dividends join on exact ex-date only; orphaned dividends are dropped.
DROP TABLE IF EXISTS sl_px;
CREATE TABLE sl_px AS
WITH elig AS (
  SELECT symbol FROM cts WHERE close > 0 AND volume > 0
  GROUP BY symbol HAVING avg(close * volume) > 2e7
), base AS (
  SELECT c.tdate, c.symbol, c.close AS raw_close, c.close * f.f AS c, c.open * f.f AS o,
         c.close * c.volume AS dvol, COALESCE(dv.d, 0) * f.f AS d
  FROM cts c JOIN elig USING (symbol)
  CROSS JOIN LATERAL (
    SELECT COALESCE(exp(sum(ln(sp.pre::float8 / sp.post))), 1) AS f
    FROM splits sp WHERE sp.symbol = c.symbol AND sp.tdate > c.tdate AND sp.pre > 0 AND sp.post > 0
  ) f
  LEFT JOIN LATERAL (
    SELECT sum(dividend) AS d FROM dividend x WHERE x.symbol = c.symbol AND x.tdate = c.tdate
  ) dv ON true
  WHERE c.tdate >= '1993-01-01' AND c.close > 0 AND c.open > 0
), feat1 AS (
  SELECT *,
    c / lag(c) OVER w - 1 AS ret,
    c / lag(c, 252) OVER w - 1 AS mom,
    avg(dvol) OVER (w ROWS BETWEEN 59 PRECEDING AND CURRENT ROW) AS adv60,
    row_number() OVER w AS n,
    tdate - lag(tdate) OVER w AS gap
  FROM base WINDOW w AS (PARTITION BY symbol ORDER BY tdate)
), feat AS (
  SELECT *, stddev_samp(ret) OVER (PARTITION BY symbol ORDER BY tdate ROWS BETWEEN 251 PRECEDING AND CURRENT ROW) AS vol
  FROM feat1
), glitch AS (
  SELECT DISTINCT symbol FROM (
    SELECT symbol, ret, lead(ret) OVER (PARTITION BY symbol ORDER BY tdate) AS nret FROM feat
  ) g WHERE (ret > 0.5 AND nret < -0.3) OR (ret < -0.5 AND nret > 0.3)
)
SELECT tdate, symbol, o::float8 AS o, c::float8 AS c, d::float8 AS d, mom::float8 AS mom, vol::float8 AS vol,
       adv60::float8 AS adv60,
       (raw_close >= 5 AND adv60 >= 5e6 AND n >= 253 AND gap <= 7 AND mom IS NOT NULL AND vol IS NOT NULL
        AND symbol NOT IN (SELECT symbol FROM glitch)
        AND symbol !~ '-'
        AND symbol NOT IN ('NYA','COMP','NDX','SPX','OEX','XMI','XCI','XII','XOI','TCMP','ABF','ARM','SAB','BIX','BKX','CEX','DFX','DJC','IUX','KIX','KSX','RLX','RUT','SGX','UTY','VAY')) AS ok
FROM feat;
CREATE INDEX sl_px_tdate ON sl_px (tdate) WHERE ok;
CREATE INDEX sl_px_symbol ON sl_px (symbol, tdate);
ANALYZE sl_px;
