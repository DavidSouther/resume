-- Question 3: turnout_k, the turnout multiplier for each comparable race from 2014 on.
--
-- Run after 10_seat_prior.sql. By hand: `duckdb out/elections.duckdb` then `.read sql/40_turnout_k.sql`.
-- 45_turnout_plausibility.sql adds the plausibility columns, and its select is the answer file.
--
-- Prior votes are D0 and R0 and current votes are D1 and R1. If every prior voter kept their side and only turnout moved,
-- each side's turnout ratio is a = D1 / D0 and b = R1 / R0, and k = a / b is how many times more Democratic voters turned out
-- than Republican voters, relative to the prior election. k = 1 means no shift.
-- flip_share is the persuasion only reading: the share of the prior two party electorate that would switch sides, at fixed turnout,
-- to give the same change in two party share. It is the current minus the prior Democratic two party share, so a positive value
-- means Republican voters moving to the Democrat.
-- comparable already requires D0, R0, D1, and R1 above zero, so no ratio divides by zero.

create or replace view turnout_k as
select
    year, state, office, seat, special, prior_year,
    prior_dem_votes as d0, prior_gop_votes as r0, dem_votes as d1, gop_votes as r1,
    prior_total_votes, total_votes,
    dem_votes / prior_dem_votes as a,
    gop_votes / prior_gop_votes as b,
    a / b as k,
    dem_share - prior_dem_share as flip_share,
    redrawn
from seat_prior
where comparable and year >= 2014;
