-- Question 1 by presidential lean: each 2026 race against the prior election for its seat, with the state's presidential lean.
-- analyze.py writes this select to answers/seat_change_2026_by_lean.csv.
--
-- Run after 00_views.sql and 10_seat_prior.sql. By hand: `duckdb out/elections.duckdb` then `.read sql/22_seat_change_by_lean.sql`.
--
-- The rows and margin columns are those of 20_seat_change_2026.sql. presidential_lean is the state's lean for the race year from
-- presidential_lean.csv: the latest presidential election strictly before the year, swing when the absolute margin is 5.0 points
-- or less, and otherwise red or blue by the winner. president_year and lean_margin name that election and its margin, in points.
-- A non comparable race keeps its row, so each lean group can count the races it leaves out.
select
    s.year, s.state, s.office, s.seat, s.special,
    pl.lean as presidential_lean,
    pl.president_year,
    pl.margin as lean_margin,
    s.prior_year,
    (2 * s.prior_dem_share - 1) * 100 as prior_margin,
    (2 * s.dem_share - 1) * 100 as margin,
    (2 * s.dem_share - 1) * 100 - (2 * s.prior_dem_share - 1) * 100 as margin_change,
    s.comparable, s.redrawn, s.official
from seat_prior s
left join presidential_lean pl on pl.state = s.state and pl.year = s.year
where s.year = 2026
order by s.state, s.office, s.seat, s.special;
