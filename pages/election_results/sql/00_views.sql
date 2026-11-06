-- Loads the pulled CSVs into tables of elections.duckdb, so the database stands alone once built.
--
-- The CSV names are relative. analyze.py sets file_search_path to the data/ folder and data/overrides/ before it runs this file.
-- By hand, from pages/election_results/:
--   duckdb out/elections.duckdb
--   SET file_search_path = 'data,data/overrides';
--   .read sql/00_views.sql
-- Column types are fixed here, so a small or mostly empty CSV cannot change a column's type.

-- data/sources.csv: every source the other tables cite by source_id, with its url and the date it was fetched or checked (empty when unknown).
create or replace table sources as
select * from read_csv('sources.csv', header = true, types = {
    'source_id': 'BIGINT', 'name': 'VARCHAR', 'url': 'VARCHAR', 'fetched_at': 'VARCHAR'
});

create or replace table races as
select * from read_csv('races.csv', header = true, types = {
    'year': 'BIGINT', 'state': 'VARCHAR', 'office': 'VARCHAR', 'seat': 'BIGINT', 'special': 'BOOLEAN', 'round': 'VARCHAR',
    'dem_candidate': 'VARCHAR', 'dem_votes': 'BIGINT', 'dem_pct': 'DOUBLE',
    'gop_candidate': 'VARCHAR', 'gop_votes': 'BIGINT', 'gop_pct': 'DOUBLE',
    'other_votes': 'BIGINT', 'total_votes': 'BIGINT', 'winner_party': 'VARCHAR',
    'incumbent_name': 'VARCHAR', 'incumbent_party': 'VARCHAR', 'incumbent_running': 'BOOLEAN', 'paired_incumbents': 'BOOLEAN',
    'redrawn': 'BOOLEAN', 'official': 'BOOLEAN', 'source_id': 'BIGINT'
});

create or replace table baseline_races as
select * from read_csv('baseline_races.csv', header = true, types = {
    'year': 'BIGINT', 'state': 'VARCHAR', 'office': 'VARCHAR', 'seat': 'BIGINT', 'special': 'BOOLEAN', 'round': 'VARCHAR',
    'dem_candidate': 'VARCHAR', 'dem_votes': 'BIGINT', 'dem_pct': 'DOUBLE',
    'gop_candidate': 'VARCHAR', 'gop_votes': 'BIGINT', 'gop_pct': 'DOUBLE',
    'other_votes': 'BIGINT', 'total_votes': 'BIGINT', 'winner_party': 'VARCHAR',
    'incumbent_name': 'VARCHAR', 'incumbent_party': 'VARCHAR', 'incumbent_running': 'BOOLEAN', 'paired_incumbents': 'BOOLEAN',
    'redrawn': 'BOOLEAN', 'official': 'BOOLEAN', 'source_id': 'BIGINT'
});

create or replace table candidates as
select * from read_csv('candidates.csv', header = true, types = {
    'year': 'BIGINT', 'state': 'VARCHAR', 'office': 'VARCHAR', 'seat': 'BIGINT', 'special': 'BOOLEAN', 'round': 'VARCHAR',
    'candidate': 'VARCHAR', 'party': 'VARCHAR', 'votes': 'BIGINT', 'total_votes': 'BIGINT', 'pct': 'DOUBLE',
    'incumbent': 'BOOLEAN', 'official': 'BOOLEAN', 'source_id': 'BIGINT'
});

create or replace table baseline_candidates as
select * from read_csv('baseline_candidates.csv', header = true, types = {
    'year': 'BIGINT', 'state': 'VARCHAR', 'office': 'VARCHAR', 'seat': 'BIGINT', 'special': 'BOOLEAN', 'round': 'VARCHAR',
    'candidate': 'VARCHAR', 'party': 'VARCHAR', 'votes': 'BIGINT', 'total_votes': 'BIGINT', 'pct': 'DOUBLE',
    'incumbent': 'BOOLEAN', 'official': 'BOOLEAN', 'source_id': 'BIGINT'
});

create or replace table presidential_lean as
select * from read_csv('presidential_lean.csv', header = true, types = {
    'state': 'VARCHAR', 'year': 'BIGINT', 'president_year': 'BIGINT', 'margin': 'DOUBLE', 'lean': 'VARCHAR'
});

create or replace table senate_delegation as
select * from read_csv('senate_delegation.csv', header = true, types = {
    'state': 'VARCHAR', 'year': 'BIGINT', 'election_date': 'DATE', 'senator1': 'VARCHAR', 'senator1_party': 'VARCHAR',
    'senator2': 'VARCHAR', 'senator2_party': 'VARCHAR', 'lean': 'VARCHAR'
});

create or replace table turnout as
select * from read_csv('turnout.csv', header = true, types = {
    'state': 'VARCHAR', 'year': 'BIGINT', 'vep': 'BIGINT', 'total_ballots': 'BIGINT', 'official': 'BOOLEAN', 'source_id': 'BIGINT'
});

-- data/overrides/redistricting.csv: the census maps first used in 2012 and 2022 and every mid cycle map first used from 2014 to 2026.
create or replace table redistricting as
select * from read_csv('redistricting.csv', header = true, types = {
    'state': 'VARCHAR', 'first_election_year': 'BIGINT', 'kind': 'VARCHAR', 'source_id': 'BIGINT'
});

-- Window and baseline years together, so a 2014 race finds its 2008 to 2012 prior.
create or replace view all_races as
select * from races
union all by name
select * from baseline_races;

create or replace view all_candidates as
select * from candidates
union all by name
select * from baseline_candidates;
