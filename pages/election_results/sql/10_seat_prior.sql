-- seat_prior: each race beside the prior election for its seat, with the comparable flag that questions 1 to 4 share.
--
-- Run after 00_views.sql. By hand: `duckdb out/elections.duckdb` then `.read sql/10_seat_prior.sql`.
--
-- A seat is (state, office, seat): a House district (0 at large), a Senate class, or a governorship (0).
-- The prior election is the most recent earlier election for the seat, general or special, from races or baseline_races.
-- When a special and a regular election for one seat fall in the same year, the regular one is the prior.
-- dem_share is the Democratic share of the two party vote, from 0 to 1, and is null when either major party has no votes.
--
-- comparable is false when
--   the seat has no prior election,
--   the race is the first House election on a census map (a census row of redistricting falls after the prior and by this race), or
--   either election lacks a Democratic or a Republican vote count.
-- A mid cycle redraw leaves a race comparable, and redrawn (from races.csv) marks it.

-- The last word of a name in capitals, with punctuation and a generational suffix removed: "ANGUS S. KING, JR." is KING.
create or replace macro last_name(full_name) as
    list_filter(
        string_split(trim(regexp_replace(upper(full_name), '[^A-Z ]', ' ', 'g')), ' '),
        lambda w: w <> '' and w not in ('JR', 'SR', 'II', 'III', 'IV')
    )[-1];

create or replace view seat_prior as
with shares as (
    select
        *,
        case when dem_votes is not null and gop_votes is not null and dem_votes + gop_votes > 0
            then dem_votes / (dem_votes + gop_votes) end as dem_share
    from all_races
),
ranked as (
    select
        cur.*,
        p.year as prior_year,
        p.special as prior_special,
        p.dem_candidate as prior_dem_candidate,
        p.dem_votes as prior_dem_votes,
        p.dem_pct as prior_dem_pct,
        p.gop_candidate as prior_gop_candidate,
        p.gop_votes as prior_gop_votes,
        p.gop_pct as prior_gop_pct,
        p.total_votes as prior_total_votes,
        p.winner_party as prior_winner_party,
        p.round as prior_round,
        p.dem_share as prior_dem_share,
        row_number() over (
            partition by cur.year, cur.state, cur.office, cur.seat, cur.special
            order by p.year desc nulls last, p.special asc
        ) as prior_rank
    from shares cur
    left join shares p
        on p.state = cur.state and p.office = cur.office and p.seat = cur.seat and p.year < cur.year
),
breaks as (
    select
        * exclude (prior_rank),
        office = 'house' and coalesce(redrawn, false) and exists (
            select 1 from redistricting d
            where d.state = ranked.state and d.kind = 'census'
              and d.first_election_year > ranked.prior_year and d.first_election_year <= ranked.year
        ) as census_break
    from ranked
    where prior_rank = 1
)
select
    *,
    prior_year is not null
        and not census_break
        and coalesce(dem_votes, 0) > 0 and coalesce(gop_votes, 0) > 0
        and coalesce(prior_dem_votes, 0) > 0 and coalesce(prior_gop_votes, 0) > 0 as comparable
from breaks;
