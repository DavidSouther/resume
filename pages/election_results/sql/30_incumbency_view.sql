-- incumbency_input: one row per race in the question 2 fit, which analyze.py reads to fit the regression with numpy.
--
-- Run after 10_seat_prior.sql. By hand: `duckdb out/elections.duckdb` then `.read sql/30_incumbency_view.sql`,
-- then `select * from incumbency_input`.
--
-- The population is comparable races from 2014 on, without House races that pair two incumbents. Mid cycle redrawn seats stay in.
-- Shares are Democratic shares of the two party vote, in points from 0 to 100.
-- inc_dem and inc_rep use incumbent_party, so an independent who caucuses with a party (King, Sanders) is that party's incumbent.
-- For such a race the independent stands in for the caucus party: their votes replace that party's votes, in this race and in the
-- prior race when they ran in it (matched by last name), so the share measures the incumbent and not a minor nominee.
-- presidential_lean is the state's presidential lean for the race year. The Senate delegation grouping was dropped on 2026-11-06.
-- mid_cycle is true for a House race in a state whose mid cycle map was first used that year.

create or replace view incumbency_input as
with caucus as (
    select s.year, s.state, s.office, s.seat, s.special, s.incumbent_party, c.candidate, c.votes
    from seat_prior s
    join all_candidates c
        on c.year = s.year and c.state = s.state and c.office = s.office and c.seat = s.seat
       and c.special = s.special and c.round = s.round
    where s.incumbent_running and s.incumbent_party in ('DEM', 'REP') and c.incumbent and c.party = 'OTHER'
),
caucus_prior as (
    select k.year, k.state, k.office, k.seat, k.special, max(c.votes) as votes
    from caucus k
    join seat_prior s using (year, state, office, seat, special)
    join all_candidates c
        on c.year = s.prior_year and c.state = s.state and c.office = s.office and c.seat = s.seat
       and c.special = s.prior_special and c.round = s.prior_round
    where c.party = 'OTHER' and last_name(c.candidate) = last_name(k.candidate)
    group by all
),
adjusted as (
    select
        s.*,
        case when k.incumbent_party = 'DEM' then k.votes else s.dem_votes end as fit_dem_votes,
        case when k.incumbent_party = 'REP' then k.votes else s.gop_votes end as fit_gop_votes,
        case when k.incumbent_party = 'DEM' and kp.votes is not null then kp.votes else s.prior_dem_votes end as fit_prior_dem_votes,
        case when k.incumbent_party = 'REP' and kp.votes is not null then kp.votes else s.prior_gop_votes end as fit_prior_gop_votes
    from seat_prior s
    left join caucus k using (year, state, office, seat, special)
    left join caucus_prior kp using (year, state, office, seat, special)
)
select
    a.year, a.state, a.office, a.seat, a.special,
    100.0 * a.fit_dem_votes / (a.fit_dem_votes + a.fit_gop_votes) as dem_share,
    100.0 * a.fit_prior_dem_votes / (a.fit_prior_dem_votes + a.fit_prior_gop_votes) as prior_dem_share,
    a.fit_prior_dem_votes > a.fit_prior_gop_votes as prior_winner_dem,
    coalesce(a.incumbent_running, false) and a.incumbent_party = 'DEM' as inc_dem,
    coalesce(a.incumbent_running, false) and a.incumbent_party = 'REP' as inc_rep,
    a.incumbent_party,
    a.redrawn,
    a.office = 'house' and coalesce(a.redrawn, false) and exists (
        select 1 from redistricting d where d.state = a.state and d.kind = 'mid_cycle' and d.first_election_year = a.year
    ) as mid_cycle,
    pl.lean as presidential_lean
from adjusted a
left join presidential_lean pl on pl.state = a.state and pl.year = a.year
where a.comparable
  and a.year >= 2014
  and not coalesce(a.paired_incumbents, false)
  and coalesce(a.fit_dem_votes, 0) > 0 and coalesce(a.fit_gop_votes, 0) > 0;
