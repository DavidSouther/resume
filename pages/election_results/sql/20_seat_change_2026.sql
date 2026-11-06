-- Question 1: each 2026 race against the prior election for its seat. analyze.py writes this select to answers/seat_change_2026.csv.
--
-- Run after 00_views.sql and 10_seat_prior.sql. By hand: `duckdb out/elections.duckdb` then `.read sql/20_seat_change_2026.sql`.
--
-- Shares are of all votes in the race, in points. margin is the two party margin, Democratic minus Republican, in points of the two party vote.
-- A change is null when either election lacks that party. same_dem_candidate and same_gop_candidate compare last names,
-- since MEDSL writes names in capitals and Wikipedia does not.
-- 2026 counts are not official and partial, so a race without counts yet has no row.

select
    year, state, office, seat, special,
    prior_year, prior_special,
    prior_dem_candidate, dem_candidate,
    prior_gop_candidate, gop_candidate,
    prior_dem_pct, dem_pct, dem_pct - prior_dem_pct as dem_pct_change,
    prior_gop_pct, gop_pct, gop_pct - prior_gop_pct as gop_pct_change,
    (2 * prior_dem_share - 1) * 100 as prior_margin,
    (2 * dem_share - 1) * 100 as margin,
    (2 * dem_share - 1) * 100 - (2 * prior_dem_share - 1) * 100 as margin_change,
    last_name(dem_candidate) = last_name(prior_dem_candidate) as same_dem_candidate,
    last_name(gop_candidate) = last_name(prior_gop_candidate) as same_gop_candidate,
    incumbent_party, incumbent_running,
    comparable, redrawn, official
from seat_prior
where year = 2026
order by state, office, seat, special;
