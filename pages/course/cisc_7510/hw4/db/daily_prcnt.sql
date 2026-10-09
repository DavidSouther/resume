-- DAILY_PRCNT: daily total return in percent, adjusted for splits and dividends.
-- Safe to re-run. Drop daily_prcnt_mat first to rebuild the materialized copy.
CREATE INDEX IF NOT EXISTS cts_symbol_tdate      ON cts      (symbol, tdate);
CREATE INDEX IF NOT EXISTS splits_symbol_tdate   ON splits   (symbol, tdate);
CREATE INDEX IF NOT EXISTS dividend_symbol_tdate ON dividend (symbol, tdate);

-- One row per positive close that has an earlier positive close.
-- Events dated after the previous price row, up to and including today, apply to today.
CREATE OR REPLACE VIEW daily_prcnt_gap_base AS
SELECT p.tdate, p.symbol, p.close, p.prev_tdate, p.prev_close,
       COALESCE(s.factor, 1) AS factor,
       COALESCE(d.dividends, 0) AS dividends
FROM (
  SELECT tdate, symbol, close,
         lag(tdate) OVER w AS prev_tdate,
         lag(close) OVER w AS prev_close
  FROM cts
  WHERE close > 0
  WINDOW w AS (PARTITION BY symbol ORDER BY tdate)
) p
LEFT JOIN LATERAL ( -- LATERAL to have access to `p` columns in this side
  -- Attach Split factor to closing prices (1 for no split)
  SELECT exp(sum(ln(sp.post::float8 / sp.pre))) AS factor
  FROM splits sp
  WHERE sp.symbol = p.symbol AND sp.tdate > p.prev_tdate AND sp.tdate <= p.tdate
    AND sp.pre > 0 AND sp.post > 0
) s ON true -- ON required, but WHERE already did the filtering
LEFT JOIN LATERAL (
  -- Attach dividends to closing records
  SELECT sum(dv.dividend) AS dividends
  FROM dividend dv
  WHERE dv.symbol = p.symbol AND dv.tdate > p.prev_tdate AND dv.tdate <= p.tdate
) d ON true
WHERE p.prev_tdate IS NOT NULL;

CREATE OR REPLACE VIEW daily_prcnt (tdate, symbol, prcnt) AS
SELECT tdate, symbol,
       -- Base percent is (close + dividends) * split factor, scaled to prev_close, times 100 for pct.
       100 * (((close + dividends) * factor)::numeric / prev_close - 1)
FROM daily_prcnt_gap_base;

CREATE OR REPLACE VIEW daily_prcnt_gap (tdate, symbol, gap_days) AS
SELECT tdate, symbol, tdate - prev_tdate FROM daily_prcnt_gap_base;

CREATE MATERIALIZED VIEW IF NOT EXISTS daily_prcnt_mat AS
SELECT tdate, symbol, prcnt FROM daily_prcnt;
CREATE INDEX IF NOT EXISTS daily_prcnt_mat_symbol_tdate ON daily_prcnt_mat (symbol, tdate);
