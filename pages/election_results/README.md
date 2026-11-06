# Election results, 2014 to 2026

U.S. House, U.S. Senate, and governor general election results from 2014 through 2026 as CSV files, with a DuckDB database and four answered questions built from them. Everything is a local output. The pulled and answer CSVs live in `data/` and the working files (`elections.duckdb`, `findings.json`, the report) in `out/`. Nothing here is released, and publishing to the site or a release is a later change.

## Sources table

`data/sources.csv` lists every source once, with the columns source_id, name, url, and fetched_at (a date or time, empty when unknown). Every other CSV in `data/` cites its source by `source_id`. `pull.py` reuses an id when the name and fetch time match, adds the next unused id otherwise, and rewrites the file with only the sources it used. 

## Workflow

```sh
uv run pull.py              # sources to data/*.csv, cached in .cache/ for 30 days
uv run pull.py --refresh 2026   # refetch only the 2026 sources
uv run analyze.py           # out/elections.duckdb and data/answers/*.csv
uv run report.py            # out/report/index.html (step 6)
uv run run_tests.py         # unit tests
uv run tests/test_feature_election_results.py   # the end to end feature test
```

`pull.py` takes `--data DIR` (default `data/`, where it writes the CSVs and `load_report.txt`, and reads `overrides/` and `sources.csv`), `--cache DIR` (default `.cache/`), `--refresh YEAR` (repeatable), and `--max-age-days N` (default 30). `analyze.py`, `findings.py`, and `report.py` take `--data DIR` (default `data/`) and `--out DIR` (default `out/`).csv`), and `--redistricting FILE` (default `data/overrides/redistricting.csv`).

## Outputs

- `candidates.csv` holds one row per candidate per race and round, for 2014 to 2026. Fusion lines are summed into one row under the candidate's major party.
- `races.csv` holds one row per race from its deciding round, with the top Democrat and the top Republican, all other votes, and the incumbency and `redrawn` columns. A race lacking either major party keeps its row with that party's fields empty. The incumbency columns are `incumbent_name`, `incumbent_party`, `incumbent_running`, and `paired_incumbents` (see Incumbency below).
- `presidential_lean.csv` holds state, year, president_year, margin, and lean for every state and every year from 2008 to 2026. The margin is the Democratic minus the Republican share of all presidential votes, in points, from the latest presidential election strictly before the year, so a presidential year looks four years back. An absolute margin of 5.0 or less is `swing`, and otherwise the lean is `red` or `blue`.
- `senate_delegation.csv` is still pulled and loaded into the database, but no answer uses it since the user dropped the Senate delegation grouping of question 2 on 2026-11-06. It holds state, year, election_date, senator1, senator1_party, senator2, senator2_party, and lean for every state and every November general election day from 2008 to 2026. The senators are those serving the day before the election, with independents counted by caucus, so King, Sanders, and Manchin count as Democrats. Two Republicans are `red`, two Democrats are `blue`, and any other pair is `purple`.
- `turnout.csv` holds state, year, vep, total_ballots, official, and source_id for each even year from 2008 on. An empty `total_ballots` means the Election Lab reports none for that state and year (it never becomes a zero), and `official` is false for the Election Lab's own estimates before states certify.
- `baseline_candidates.csv` and `baseline_races.csv` hold the same columns for 2008 to 2013, used only as priors. The off year governor races of 2009, 2011, and 2013 are here, so every governor race from 2014 on has a prior.
- `load_report.txt` counts races per year and office, names the turnout years found, and lists every race that could not be read, or was read only in part. A race in that list is never written with zeros. It is either absent or written from the counts that exist.

Percentages are of the votes cast for candidates in the race, from 0 to 100. Booleans are lowercase `true` and `false`, and an empty cell is a null.

## Analysis

`analyze.py` builds `out/elections.duckdb` and writes five files to `data/answers/`. It runs in under a second on a full pull. The SQL is in `sql/`, one file per step:

| File | Creates | Answer file |
| --- | --- | --- |
| `00_views.sql` | tables `races`, `baseline_races`, `candidates`, `baseline_candidates`, `presidential_lean`, `senate_delegation`, `turnout`, `redistricting`, and the views `all_races` and `all_candidates` | |
| `10_seat_prior.sql` | view `seat_prior` (each race beside its seat's prior election, `census_break`, `comparable`) and the macro `last_name` | |
| `20_seat_change_2026.sql` | | `seat_change_2026.csv` (question 1) |
| `22_seat_change_by_lean.sql` | | `seat_change_2026_by_lean.csv` (question 1 by presidential lean) |
| `30_incumbency_view.sql` | view `incumbency_input`, the population of the question 2 fit | |
| `40_turnout_k.sql` | view `turnout_k` with `a`, `b`, `k`, and `flip_share` | |
| `45_turnout_plausibility.sql` | | `turnout_k.csv` (question 3, with the plausibility columns) |
| `50_dummymander.sql` | | `dummymander.csv` (question 4) |

The incumbency file (question 2), by presidential lean, comes from the numpy fit in `analyze.py` on `incumbency_input`. Every file runs by hand in the DuckDB CLI against the built database, for example `duckdb out/elections.duckdb` and then `.read sql/45_turnout_plausibility.sql`. Rebuilding the tables by hand needs `SET file_search_path = 'out,data';` before `.read sql/00_views.sql`, since the CSV names in it are relative.

- Prior election. The prior for a seat is its most recent earlier election, general or special, from the window or the baseline files. A regular election wins over a special of the same year.
- `comparable` is false when the seat has no prior, when the race is the first House election on a census map, or when either election lacks a Democratic or a Republican vote count. A seat whose prior was uncontested is therefore not comparable. In the 2026 AP pull, 30 of the 38 Texas House seats are comparable, and district 9 is not, since Al Green ran without a Republican opponent in 2024.
- Question 1 by lean. `seat_change_2026_by_lean.csv` holds every 2026 race with its state's `presidential_lean`, `president_year`, and `lean_margin` from `presidential_lean.csv`, and the same margin columns as `seat_change_2026.csv`. Non comparable races keep their rows, so each lean group can count the races it leaves out.
- Question 1 compares last names for `same_dem_candidate` and `same_gop_candidate`, since MEDSL writes names in capitals and AP and Wikipedia do not. The margin columns are points of the two party vote.
- Question 3 asks what change in turnout alone would be necessary to explain each race. For each race, `k` is the relative change in Democratic versus Republican turnout that reproduces the observed shift if no voter changed sides, and the plausibility check compares the implied extra Democratic votes (`required_extra_dem_votes`) against the ballots actually added (`comparison_change`). `flip_share` is the current minus the prior Democratic two party share, as a fraction, so a positive value is Republican voters moving to the Democrat. `k_effective` equals `k` by construction (both are D1 R0 over R1 D0) and is kept as the plan names it. Statewide columns are null for odd years and for any year the Election Lab has not published.
- Question 2. The fit drops a collinear column (for example the prior winning party when every prior winner in a group is a Democrat) instead of failing. A party row with fewer than 5 running incumbents reports its seat count with a null bonus and a null cross check. `wald_diff` is the DEM bonus minus the REP bonus, both in each party's own sign, which is beta_D + beta_R in the raw Democratic share coefficients. The cross check of the pooled scope pools all years, without a per year adjustment.
- King and Sanders. For a race whose running incumbent is an independent counted with a caucus party, the fit uses the independent's votes as that party's votes, in that race and in the prior race when the independent ran in it. Otherwise the Democratic share of King's race would measure the minor Democratic nominee.
- Question 4 uses the same population as question 2. A year with a mid cycle state always has a `redrawn` and a `not_redrawn` row, and a group with no comparable incumbent race has `races = 0` and a null mean.

## Findings

`uv run findings.py` reads the answer CSVs, `races.csv`, `candidates.csv`, `load_report.txt`, `elections.duckdb`, and the cached AP `progress.json`, and writes `out/findings.json`. It writes through a temporary file and a rename, so a failed run leaves an earlier file untouched, and it prints one `<key>: <value>` line per selector. `uv run findings.py --check FILE` validates a file against `findings.schema.json` and writes nothing. A missing input stops the run with exit status 1, naming the file and the command that makes it.

The file holds these members:

- `run`: the generation time, tool versions, every input with its path, sha256, bytes, and rows, each source's fetch time, and the 2026 counts per office (races, AP races, unofficial and certified races, races below 100 and below 95 percent of expected vote, and the lowest and median expected vote).
- `sources`: every data source behind the answers, with what it supplies, its URL or path, its latest fetch time and rows in `candidates.csv` (null for a source that reaches the answers through another file), and its caveats.
- `questions`: for each of the four questions, `sql` holds the exact text of the SQL files and the `analyze.py` functions that implement it, each with the sha256 of that text, and `raw_results` holds the 2026 answer rows, at most 50 rows per table, with `total_rows`, `truncated`, and each column's kind and unit. Numeric cells are rounded for display: points to two decimals, `k`, `a`, `b`, and `flip_share` to three, vote counts to whole numbers with thousands separators, and `wald_p` to three significant figures. Identifiers and text are verbatim, and the full precision values stay in `out/answers/`, hashed in `run.inputs`. The SQL text is read from the repository when `findings.py` runs, so rerun `analyze.py` and `findings.py` together after an SQL change.
- `thresholds`: every number a rule uses, by name.
- `rules`: each family's rule as sentences, in evaluation order.
- `selectors`: 69 keys, each mapped to one enumerated value.
- `claims`: per selector, the value, the rule sentence that fired, the raw `numbers` (null where absent), the `display` strings the page quotes, the `trigger_fields` the branch used, the `cells` (each number at a fixed table precision with no unit, or null), and the `evidence` (race keys `YEAR:STATE:OFFICE:SEAT`, with `:special` for a special, and answer row identifiers such as `incumbency_senate_delegation.csv:house,red,2026,DEM`).

Every rule reads 2026 rows, and the thresholds below are the defaults.

| Family | Keys | Rule, in evaluation order |
| --- | --- | --- |
| `completeness` | `completeness` | `no_2026_data` when no 2026 race cites the source named `ap`. `certified` when no 2026 race is unofficial. `counting_nearly_complete` when every AP race has an expected vote of at least 95 percent. Otherwise `counting_in_progress`. |
| `seat_shift` | `seat_shift.<office>` | Over comparable races with a `margin_change`: `insufficient_data` below 5 races, `toward_dem` when the median is at least plus 1 point, `toward_rep` when it is at most minus 1 point, and otherwise `no_clear_shift`. |
| `party_flips` | `party_flips.<office>` | A flip is a change of sign between `prior_margin` and `margin`. `insufficient_data` below 5 races, `none` with no flips, `dem_net_gain` or `rep_net_gain` by the larger count, and `even_exchange` when the counts are equal and above zero. |
| `seat_shift_by_lean` | `seat_shift_by_lean.<office>.<lean>` | The `seat_shift` rule over the races of one presidential lean group (`red`, `blue`, or `swing`) from `seat_change_2026_by_lean.csv`, with the group's count of races left out as not comparable. |
| `party_flips_by_lean` | `party_flips_by_lean.<office>.<lean>` | The `party_flips` rule over the races of one presidential lean group, with the same count of races left out. |
| `incumbency_party_gap` | `incumbency_party_gap.presidential.<office>.<lean>` | On the 2026 year scope: `insufficient_data` when `wald_p` is null, `no_difference` when `wald_p` is at least 0.10, `rep_lower` when `wald_diff` (the DEM bonus minus the REP bonus) is positive, and `dem_lower` when it is negative. |
| `significance` | `significance.presidential.<office>.<lean>` | `not_tested` when `wald_p` is null, then `p_below_0_05`, `p_below_0_10`, or `p_at_or_above_0_10`. |
| `bonus_vs_history` | `bonus_vs_history.presidential.<office>.<lean>.<DEM or REP>` | `insufficient_data` when the 2026 bonus is null or fewer than 3 years from 2014 to 2024 have one. `below_all_prior_years` or `above_all_prior_years` when outside their range, and otherwise `within_prior_range`. |
| `turnout_explanation` | `turnout_explanation.<office>` | Over races with a `turnout_plausible`: `insufficient_data` below 5 races, `turnout_plausible_majority` when more than half are plausible, `persuasion_needed_majority` when fewer than half are, and `evenly_split` at exactly half. |
| `k_direction` | `k_direction.<office>` | `insufficient_data` below 5 races with a `k`, `dem_relative_gain` when the median `k` is above 1.02, `rep_relative_gain` when it is below 0.98, and otherwise `near_parity`. |
| `dummymander` | `dummymander.house` | `insufficient_data` when either group has fewer than 5 races or a null mean, `redrawn_incumbents_worse` when `difference` is at most minus 1 point, `redrawn_incumbents_better` when it is at least plus 1 point, and otherwise `no_clear_difference`. The comparison is a raw difference of means with no significance test. |
| `dummymander_vs_history` | `dummymander_vs_history.house` | `insufficient_data` when the 2026 finding is insufficient or no earlier year has a difference, `largest_gap_on_record` when the absolute 2026 difference exceeds every earlier year's, and otherwise `within_prior_range`. |

To check a label by hand, read `claims[key].rule` for the branch that fired, compare `claims[key].numbers` with `thresholds`, and look up the rows in `claims[key].evidence` in `races.csv` or the named answer file.

### The report page

`page.ts` renders the route `/election_results/` from `out/findings.json` at site build time. Set `ELECTION_FINDINGS` to read another file. The page shows a completeness banner, an overview of the data sources, and then, for each question, its methodology, formulas, SQL and code, raw results, and the selected finding. SQL, code, and raw results sit in collapsed accordions, and listings are highlighted at build time with highlight.js. Each finding opens with a table of its numbers, one precision per column with units in the headers and a dash for a missing value, and the selected sentences follow as paragraphs. An audit panel lists every threshold, rule, and input hash, and holds the file verbatim with a download link that carries its exact bytes. Every sentence the page can show is written in advance in `page.ts`, one per value of each selector, and the page quotes only the display strings `findings.py` wrote, so it never formats a number itself.

A missing file shows a no findings state that names the command to run, and a file that fails the page's checks shows an invalid findings state naming the first problem. A build with `CI` or `GITHUB_ACTIONS` set never reads the file, so the deployed page always shows the no findings state and carries no AP numbers. The page is `noindex` and is not in the sitemap.

To view it, run `findings.py`, then `node scripts/serve.ts --port 8080 --watch` from the repository root, and open `http://127.0.0.1:8080/election_results/`. The watching server rebuilds the page when `findings.json` changes.

## Sources

| Source | Used for | Access |
| --- | --- | --- |
| MEDSL, U.S. Senate statewide 1976 to 2024, doi:10.7910/DVN/PEJ5QU | Senate results 2008 to 2024 | Anonymous Dataverse download of datafile 13887039 |
| MEDSL, U.S. House 1976 to 2024, doi:10.7910/DVN/IG0UN2 | House results 2008 to 2024 | Guestbook gated, see below |
| Wikipedia, "YYYY United States gubernatorial elections" and each linked state race page | Governors 2008 to 2025, and 2026 governor incumbents and races AP lacks | MediaWiki parse API, `prop=wikitext\|revid` |
| AP Elections live results, `metadata.json` and `progress.json` for 2026-11-03 | House, Senate, and governor results 2026 | `https://interactives.apelections.org/election-results/data-live/2026-11-03/results/national/`, see below |
| Wikipedia, "2026 United States Senate elections" and each linked state race page | Senate 2026 races AP lacks | MediaWiki parse API |
| Wikipedia, "2026 United States House of Representatives elections in STATE" | House 2026 races AP lacks | MediaWiki parse API |
| `data/overrides/result_overrides.csv`, hand entered from the Wikipedia revision cited on each row | Runoffs, ranked choice final rounds, and MEDSL gaps | Committed |
| Ballotpedia, redistricting after the 2010 and 2020 censuses and each mid cycle redraw | `data/overrides/redistricting.csv` | Cited per row |
| `unitedstates/congress-legislators`, `legislators-current.json` and `legislators-historical.json` | House and Senate incumbency, Senate delegation | `https://unitedstates.github.io/congress-legislators/`, the current file refreshed with `--refresh 2026` |
| MEDSL, U.S. President 1976 to 2024, doi:10.7910/DVN/42MVDX | Presidential lean | Anonymous Dataverse download of datafile 13887042 |
| University of Florida Election Lab, general election turnout | `turnout.csv` | `Turnout_1980_2022_v1.2.csv`, plus the file each of the 2024 and 2026 turnout pages names (now `Turnout_2024G_v0.4.csv` and `Turnout_2026G_v0.2.csv`) |

### Incumbency

- Senate. The senator holding the seat (state and class) on the November general election day is the incumbent only after two years of continuous service in that seat, so an appointee such as Husted in Ohio in 2026, or a special election winner seated within two years, is not one. Such a race has an empty `incumbent_name` and `incumbent_running = false`, and `incumbent_party` is still the holder's party.
- House. Each member serving on election day is placed in the race of their state whose ballot carries their name, whatever district number they held, so a member moved by a redraw is the incumbent in the district they run in. A ballot name matches a member when it holds the member's last name and their first, nick, or middle name. A first initial alone counts only in the member's own district number. Two members on one ballot set `paired_incumbents`, and `incumbent_name` then lists both, separated by a semicolon. A race with no member on its ballot is open, and takes the member holding that district number on election day (or the last one, when the seat is vacant) as `incumbent_name` and `incumbent_party`. A new district with no earlier holder has both empty. A special election fills a vacancy, so it has no incumbent running and takes the party of the member who left.
- Governor. The officeholder is the infobox `before_election` field of the race page, with its `before_party`. The officeholder is running when a candidate's name matches or the page marks a candidate as the incumbent. An incumbent who withdrew but stayed on the ballot (Walker in Alaska in 2018) counts as running.
- An independent who caucuses with a party is an incumbent of that party. `incumbent_party` uses the caucus party, while the candidate row keeps `OTHER`.
- `incumbent` in `candidates.csv` is true exactly for the running incumbents of each race, so it follows these rules and not a page's own marker.

### Redistricting

`redrawn` is true for a House race when the state's first election on a new map is the race year, and false for single district states and for every Senate and governor race. `data/overrides/redistricting.csv` lists the census maps first used in 2012 and 2022 and every mid cycle map first used from 2014 to 2026. Each mid cycle row was checked against the Ballotpedia page at its `source_id` in `data/sources.csv` on 2026-11-05:

| State | First election | Ballotpedia page | What changed |
| --- | --- | --- | --- |
| FL | 2016 | United States House of Representatives elections in Florida, 2016 | The Florida Supreme Court adopted a new map in December 2015. |
| NC | 2016 | Cooper v. Harris | The General Assembly enacted a remedial map in February 2016 after a federal court struck two districts. |
| VA | 2016 | United States House of Representatives elections in Virginia, 2016 | A court drawn map was used after the U.S. Supreme Court rejected the appeal in May 2016. |
| PA | 2018 | United States House of Representatives elections in Pennsylvania, 2018 | The Pennsylvania Supreme Court adopted a new map in February 2018. |
| NC | 2020 | United States House of Representatives elections in North Carolina, 2020 | A state court let the map redrawn in November 2019 stand. |
| AL, GA, LA, NY, NC | 2024 | Congressional district maps implemented after the 2020 census | Court ordered maps in Alabama, Georgia, and Louisiana, a new map signed in February 2024 in New York, and a new legislative map in North Carolina. |
| AL, CA, FL, LA, NC, OH, TN, TX, UT | 2026 | Redistricting ahead of the 2026 elections | Ballotpedia lists these nine states with new maps for 2026. |

Missouri enacted a new map in 2025, but Ballotpedia reports that the 2022 map was used for the 2026 general election after the veto referendum ruling, so Missouri has no 2026 row. Virginia's 2026 amendment was blocked by the Virginia Supreme Court, and Ohio kept its 2022 map for 2024, so neither has a row for those years.

Unverified: none of the listed rows. The court ordered redraws from 2014 to 2020 were checked state by state rather than against one national list. A redraw in a state not named here would be missed, and Ballotpedia's 2026 page supports the list only to the extent that it says just two states redistricted voluntarily in the middle of a decade between 1970 and 2025.

### AP results for 2026

The 2026 House, Senate, and governor counts come from the two files that AP's results page at `https://apnews.com/projects/elections-2026/` loads. The endpoint is unofficial and undocumented, and it may change shape or disappear without notice. The files are fetched with a browser User-Agent and gzip encoding, cached as `.cache/ap/2026-11-03/metadata.json` and `progress.json`, and refetched with `uv run pull.py --refresh 2026` (or after 30 days). Every 2026 row AP supplies cites the source named `ap`, whose `fetched_at` is the fetch time of `progress.json`.

- Seats. A House race takes AP's `seatNum` as its district, and an at large state (which AP numbers 1) is district 0. A Senate race takes `seatNum` as its class. A `Special General` race is `special = true`, which covers the Ohio and Florida Senate specials. The national House vote total AP files as a 436th House entry is not a race and is listed in the load report.
- Parties. `Dem` is `DEM`, `GOP` is `REP`, and every other code is `OTHER`. A candidate AP lists as caucusing with a party (`caucusWith`), such as Kiley in California's 6th district, keeps `OTHER` on the candidate row, as the caucus rule below asks.
- Status. `official` is true only when AP marks the race `isCertified`. A race counted below 100 percent of its expected vote (`eevp`) is written with its partial counts and listed with its `eevp` in `load_report.txt`. AP caps a called race at 99, so nearly every race is listed until certification.
- Lines. Blank, over, and under vote lines are dropped, a write in total with no votes is dropped, and named or counted write ins stay as `OTHER`. AP reports one line per candidate, so fusion votes are already combined.
- Uncontested races. A race whose only candidate AP never counted (Florida leaves such a race off the ballot) keeps its row with null votes, null shares, and its winner's party, so nothing is zero filled.
- Rounds. AP reports the first round of the Alaska and Maine ranked choice races and the November round of a race headed to a runoff. Both are stored as `general`. A ranked choice race with no majority, a race AP marks as going to a runoff, and a race with no majority in a runoff state are listed in `load_report.txt` until `data/overrides/result_overrides.csv` adds the deciding round.

Wikipedia fills only the 2026 races AP lacks, and its load report notes for races AP covers are dropped. Wikipedia governor pages still supply each governor's incumbent, and the legislators files still supply House and Senate incumbency.

### Wikipedia pages

Each page is fetched once through the MediaWiki parse API and cached as `.cache/wikipedia/<year>/<title>.json` under the election year it describes, so `--refresh 2026` refetches only the 2026 pages. A rate limited reply (HTTP 429) is retried after the wait the server asks for. A row's source names the page and its revision id.

Results come from the page's `{{Election box ...}}` templates. The general election box is the one outside any primary, convention, recall, or lieutenant governor section. Louisiana's jungle primary is the general round, and a box titled or headed "runoff" is the runoff round. Fusion lines are summed by candidate, and the "Total" line New York pages repeat is not counted twice. A joint ticket is named by its governor.

When a statewide page has no general election box, or one with no vote counts yet, the vote counts of the nominees in the page's infobox are used. That row set holds only the infobox nominees, so `total_votes` and the shares of all votes leave out minor candidates, while the two party share is exact. Each such race is listed in `load_report.txt` as partial.

### Result overrides

`data/overrides/result_overrides.csv` holds rows with the columns year, state, office, seat, special, round, candidate, party, votes, official, and source_id. Its rows for a race and round replace every row the sources gave for that race and round, and its rows for a round the sources lack are added. A House or Senate runoff dated in an odd year (a January runoff) is stored under the November cycle it decided. Shares are recomputed from the listed votes, and the source's `fetched_at` is the date the row was checked. A missing column or an unreadable value stops the run naming the file and line.

The file now covers:

- the Georgia 2008 Senate general and runoff, which MEDSL misreports and lacks;
- the Louisiana Senate jungle primaries and runoffs of 2014 and 2016, and the Louisiana House runoffs of 2012 (district 3), 2014 (districts 5 and 6), 2016 (districts 3 and 4), and 2020 (district 5), with their November rounds, since MEDSL merges the runoff counts into the November rows;
- the Maine 2nd district first and final ranked choice rounds of 2018 and 2022, and the Alaska final rounds for the 2022 Senate race and the 2022 and 2024 House races, with the Alaska 2022 Senate first round, whose MEDSL rows carry no party;
- the 2022 Connecticut Senate race, which MEDSL lacks.

Later Georgia runoffs and Alaska or Maine final rounds in 2026 are added the same way once they are counted.

### The MEDSL House file

The House file needs a Dataverse guestbook response. A normal run reads it from `.cache/1976-2024-house.tab` and never calls Dataverse. When the file is missing, `pull.py` posts a guestbook response to `/api/access/datafile/13592823` and downloads the file from the signed URL that comes back. That needs these variables, either exported or as `NAME=value` lines in the repo root `.env` file (which is gitignored):

- `DATAVERSE_API_TOKEN`, an API token from the Harvard Dataverse account menu, sent as the `X-Dataverse-key` header
- `DATAVERSE_NAME`, `DATAVERSE_EMAIL`, `DATAVERSE_INSTITUTION`, and `DATAVERSE_POSITION`, the guestbook answers

A missing variable stops the run with these steps. Downloading the file by hand into `.cache/` works as well.

## Changes from the expected sources

- `congress-legislators` terms that ended before 2000 are skipped, since none can hold a seat on an election day from 2008 on, and some of them lack fields such as party.
- The MEDSL President file holds one 2024 write in name with a quoted line break, so it is read as ordinary CSV rather than line by line.
- The Election Lab has no single file for 2024 and 2026. Each year's turnout page names its current data file, and the pull reads that file. A year whose page names none yet is left out of `turnout.csv`. A later file's year replaces the same year in an earlier file.
- The Election Lab leaves `TOTAL_BALLOTS_COUNTED` empty for a few states in 2008 (Texas among them). Those cells stay empty in `turnout.csv`.

- Both MEDSL files are comma separated despite the `.tab` name.
- The House file wraps every data row in one pair of double quotes and writes a quote inside a field as `\"`. The parser unwraps each such row before CSV parsing.
- The House file has no `party_simplified` column. Its detailed `party` column is mapped instead: `DEMOCRAT`, `DEMOCRATIC`, `DEMOCRATIC-FARMER-LABOR`, and the North Dakota Democratic-NPL labels are `DEM`, `REPUBLICAN` is `REP`, and everything else is `OTHER`.
- Rows that count ballots instead of a candidate (over votes, under votes, blank and void votes) are dropped, so `total_votes` is the sum of candidate votes. MEDSL's own `totalvotes` is not used because it disagrees within some races (for example Georgia House 2018).
- MEDSL labels the 2008 Georgia Senate general as stage `pre`. It is read as the general.
- The January 2021 Georgia Senate runoffs are stored as `round = runoff` under 2020, the cycle they decided.
- MEDSL lists no Senate class. Regular elections take the class up that year, and every special from 2008 to 2026 has its class listed in `lib/medsl.py`, since a special can fill either seat.
- The District of Columbia delegate race is excluded.
- MEDSL gaps are filled by `data/overrides/result_overrides.csv` (see above): the 2022 Connecticut Senate race is absent, the 2022 Alaska Senate rows carry no party, and Louisiana runoffs are absent or merged into the November rows.
- Governors come from Wikipedia, since MEDSL has no national governor file. Recall elections (Wisconsin 2012, California 2021) are left out, and special elections (Utah 2010, West Virginia 2011, Oregon 2016) are kept with `special = true`.
- Wikipedia gives no structured result status. A Wikipedia row from 2026 is not `official` unless its election box text says "certified". Rows before 2026 are official.
- As of 2026-11-05, Wikipedia's 2026 House pages list vote counts for only 39 of 435 districts, so AP's live results replace Wikipedia as the 2026 source, and Wikipedia fills only races AP lacks.

## Spot checks

| Race | Source value | Pulled value |
| --- | --- | --- |
| Texas Senate 2018 | Cruz 50.9, O'Rourke 48.3 | Cruz 50.89, O'Rourke 48.33 |
| Georgia governor 2018 | Kemp 50.22, Abrams 48.83 | Kemp 50.22, Abrams 48.83 |
| Georgia Senate 2020 runoff | Ossoff 50.6, Perdue 49.4 | Ossoff 50.62, Perdue 49.38 |
| Maine 2nd district 2018, final round | Golden 142,440, Poliquin 138,931 | Golden 142,440, Poliquin 138,931 |
| Connecticut Senate 2022 | Blumenthal 723,864, Levy 535,943 | Blumenthal 723,864, Levy 535,943 |
