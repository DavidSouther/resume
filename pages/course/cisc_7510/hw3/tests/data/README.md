# Join fixtures

Each case folder holds `a.csv`, `b.csv`, and `expected.csv`. An optional
`max_memory` file gives the A budget in bytes; without it, use the CLI default
of 1048576.

`expected.csv` is in LoopJoin order: A rows outer, B rows inner. HASH and MERGE
may emit rows in another order, so compare their output as sorted lines.
MERGE also needs sorted inputs, which most of these cases do not have. The
`sorted_*` cases exist for MERGE; their `expected.csv` came from the LOOP binary.

`tests/join_fixtures.rs` runs the binary over every case for each join type.
`r#loop::tests::joins_every_fixture_case_at_its_budget` runs LoopJoin at each
case's `max_memory`.

| Case | Exercises |
|---|---|
| `single_match` | One row on each side, one match |
| `no_matches` | Disjoint keys, empty output |
| `mixed_matches` | Some keys match, B in a different order than A |
| `duplicate_keys` | Repeated keys on both sides give a cross product |
| `key_only_rows` | Rows with no fields after the key add none |
| `empty_fields` | Empty trailing fields are kept |
| `prefix_keys` | `1`, `10`, `100`, `01` are distinct keys |
| `whitespace_is_literal` | Leading/trailing spaces and case are part of the key |
| `no_trailing_newline` | Last row in each file has no record separator |
| `empty_a`, `empty_b`, `empty_both` | Empty inputs give empty output |
| `oversize_row` | An A row larger than half of `max_memory` (64) |
| `many_batches` | 200 A rows across many AsyncReader batches at `max_memory` 64 |
| `sorted_gaps` | Sorted; each side has keys the other lacks, between and around matches |
| `sorted_duplicates` | Sorted; repeated keys on A, B, and both sides |
| `sorted_prefix_keys` | Sorted; `01`, `1`, `10`, `100` are distinct keys |
