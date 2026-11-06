-- Question 4, by party: the dummymander comparison over every comparable House race, not only incumbents.
-- analyze.py writes this select to answers/dummymander_party.csv.
--
-- Run after 30_incumbency_view.sql. By hand: `duckdb out/elections.duckdb` then `.read sql/55_dummymander_party.sql`.
--
-- For each year from 2014 to 2026 with at least one mid cycle map first used that year, House races in such a state form the
-- redrawn group and House races elsewhere form the not_redrawn group. Both groups share the year, so the national tide cancels.
-- The change is the Democratic two party share minus its share in the prior election, in points. The Republican change is the
-- same number with the sign reversed, so one column serves both parties. difference is the redrawn mean minus the not_redrawn
-- mean, repeated on both rows. A positive difference means the Democratic share moved toward the party more in redrawn seats.
-- Open seats are included, which is the contrast with 50_dummymander.sql. The population is incumbency_input: comparable races,
-- no paired incumbents. A group with no races has a row with races = 0.

with mid_years as (
    select distinct first_election_year as year
    from redistricting
    where kind = 'mid_cycle' and first_election_year between 2014 and 2026
),
groups as (
    select y.year, 'house' as office, g.grp
    from mid_years y cross join (values ('redrawn'), ('not_redrawn')) g(grp)
),
changes as (
    select
        year, office,
        case when mid_cycle then 'redrawn' else 'not_redrawn' end as grp,
        dem_share - prior_dem_share as change
    from incumbency_input
    where office = 'house'
),
means as (
    select g.year, g.office, g.grp, avg(c.change) as mean_change, count(c.change) as races
    from groups g
    left join changes c using (year, office, grp)
    group by all
)
select
    year, office, grp as "group", mean_change,
    max(mean_change) filter (where grp = 'redrawn') over (partition by year, office)
        - max(mean_change) filter (where grp = 'not_redrawn') over (partition by year, office) as difference,
    races
from means
order by year, office, "group" desc;
