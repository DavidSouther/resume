-- Question 3 answer: turnout_k with a plausibility check. analyze.py writes this select to answers/turnout_k.csv.
--
-- Run after 40_turnout_k.sql. By hand: `duckdb out/elections.duckdb` then `.read sql/45_turnout_plausibility.sql`.
--
-- With the current two party share s1 = D1 / (D1 + R1):
--   D_req = R0 * s1 / (1 - s1) is the Democratic count that, with Republican voters held at R0, gives the current two party share.
--   k_effective = D_req / D0, which equals k, since s1 / (1 - s1) = D1 / R1.
--   required_extra_dem_votes = D_req - D0. A positive value is Democratic ballots that turnout alone must add, and a negative one is
--   Democratic ballots that must disappear.
--   actual_total_votes_change is the race's own change in votes cast.
--   actual_statewide_ballots_change and actual_statewide_vep_turnout_change (points) come from turnout.csv for the two years,
--   and are null when turnout.csv lacks either year (an odd year, or 2026 before the Election Lab publishes).
--   comparison_change is the race's own change on unchanged lines. For a redrawn race the lines moved, so it is the statewide change
--   scaled by the prior race's share of statewide ballots, (D0 + R0) / ballots0.
--   slack = 0.02 * (D0 + R0) allows for ballots that move between the top two candidates and the others.
--   turnout_plausible holds when a positive requirement is at most max(comparison_change, 0) + slack, or a negative one is at least
--   min(comparison_change, 0) - slack. It is null when comparison_change is null.

with checked as (
    select
        t.*,
        t.r0 * (t.d1 / (t.d1 + t.r1)) / (1 - t.d1 / (t.d1 + t.r1)) as d_req,
        t.total_votes - t.prior_total_votes as actual_total_votes_change,
        p1.total_ballots - p0.total_ballots as actual_statewide_ballots_change,
        (p1.total_ballots / p1.vep - p0.total_ballots / p0.vep) * 100 as actual_statewide_vep_turnout_change,
        p0.total_ballots as prior_statewide_ballots
    from turnout_k t
    left join turnout p0 on p0.state = t.state and p0.year = t.prior_year
    left join turnout p1 on p1.state = t.state and p1.year = t.year
),
compared as (
    select
        *,
        case when redrawn then actual_statewide_ballots_change * (d0 + r0) / prior_statewide_ballots
            else actual_total_votes_change end as comparison_change,
        0.02 * (d0 + r0) as slack
    from checked
)
select
    year, state, office, seat, special, prior_year, a, b, k, flip_share, redrawn,
    d0, r0, d1, r1,
    d_req / d0 as k_effective,
    d_req - d0 as required_extra_dem_votes,
    actual_total_votes_change,
    actual_statewide_ballots_change,
    actual_statewide_vep_turnout_change,
    comparison_change,
    slack,
    case
        when comparison_change is null then null
        when d_req - d0 > 0 then d_req - d0 <= greatest(comparison_change, 0) + slack
        else d_req - d0 >= least(comparison_change, 0) - slack
    end as turnout_plausible
from compared
order by year, state, office, seat, special;
