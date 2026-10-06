# Join fixtures

Each case folder holds `a.csv`, `b.csv`, and `expected.csv`.

`expected.csv` is in A order, then B order within each A row, which every join
type produces. MERGE also needs inputs sorted on the key, so it skips cases
whose inputs are not. The `sorted_*` cases exist for MERGE; their
`expected.csv` came from the LOOP binary.

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
| `oversize_row` | An A row much longer than the others |
| `many_batches` | 200 A rows, spanning several batches at `--max-memory 1` |
| `sorted_gaps` | Sorted; each side has keys the other lacks, between and around matches |
| `sorted_duplicates` | Sorted; repeated keys on A, B, and both sides |
| `sorted_prefix_keys` | Sorted; `01`, `1`, `10`, `100` are distinct keys |
