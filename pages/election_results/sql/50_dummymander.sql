-- Question 4: the dummymander comparison. analyze.py writes this select to answers/dummymander.csv.
--
-- Run after 30_incumbency_view.sql. By hand: `duckdb out/elections.duckdb` then `.read sql/50_dummymander.sql`.
--
-- For each year from 2014 to 2026 with at least one mid cycle map first used that year, House incumbents who ran in such a state
-- form the redrawn group and House incumbents who ran elsewhere form the not_redrawn group. Both groups share the year, so the
-- national tide cancels, and the method is the raw change in the incumbent party's two party share (points) against the prior
-- election, with no regression. difference is the redrawn mean minus the not_redrawn mean, repeated on both rows.
-- The population is incumbency_input: comparable races, no paired incumbents. A group with no races has a row with races = 0.

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
        case when inc_dem then dem_share - prior_dem_share else prior_dem_share - dem_share end as change
    from incumbency_input
    where office = 'house' and (inc_dem or inc_rep)
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
