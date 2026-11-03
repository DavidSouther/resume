# Door-log homework

Requires [uv](https://docs.astral.sh/uv/) and a running Docker daemon. `run_tests.py`
declares its Python version and its `shgit` dependency inline, so uv provisions both.
PostgreSQL and `psql` run inside the container; no local database is needed.

From the repository root:

```sh
python3 pages/course/cisc_7510/hw6/generate_sample_data.py
uv run pages/course/cisc_7510/hw6/run_tests.py
```

The generator reproduces the checked-in `sample_data.sql`: 52 events for ten
synthetic users. To write another copy, pass `--output /path/to/sample.sql`.
Load `schema.sql` before the sample when using your own PostgreSQL database.

The runner checks that the sample matches its generator, starts a disposable
`postgres:16` container, loads the schema and sample, and executes the actual
statements in `doors.sql`. It asserts known answers, checks empty input and
bathroom averages including zero-use days, and exits nonzero on failure. It uses
no host ports, disables container networking, and removes its container afterward.
Use `--image postgres:16-alpine` to select another PostgreSQL 16 image.
Q9 regressions distinguish overnight carryover followed by late re-entry from
an actual early same-day arrival.

The sample is a fixed historical log whose latest recorded state is July 5, 2024.
Judy has an unmatched building entry and re-entered the bathroom after an earlier
exit, so both current counts are one. Other cases cover exits through a different
building door, repeated visits, ordinary overnight stays, a stay spanning an
entire event-free day, a midnight exit, and arrival/departure at the fireworks time.

Known answers:

| Question | Expected result |
| --- | --- |
| 1 | 8 distinct users entered through door 1 |
| 2 / 2b / 3 | 1 each |
| 4 | 3 at the inclusive timestamp boundary |
| 5 | All 365 dates in 2021; January 1 has 2, January 3–9 have 1 each, all others have 0 |
| 6 | Mean `9 / 365`; sample deviation `sqrt((11 - 81 / 365) / 364)` |
| 7 | 50% |
| 8 | 7 bathroom entries divided by all calendar days from January 1, 2021 through the database's current date |
| 9 | 50% of employees who arrived that day before 17:15 |
| 10 | `bob` |

The tests preserve the reviewed queries' conventions: exit timestamps are
inclusive, including a midnight floor exit on the following date; unfinished stays
extend through the current timestamp; and a full intervening day during a
multi-day stay counts as presence. That last case still differs from question 5's
literal instruction to return zero on days without entry/exit events. The fixture
records this distinction explicitly. Question 8 uses calendar days from the first
door-log event through `CURRENT_DATE`, so its numeric result changes with the
database date. An empty log has no observation window and returns NULL for that
average; an observed window with no bathroom entries returns zero.
