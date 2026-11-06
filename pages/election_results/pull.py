#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Pull House, Senate, and governor results for 2008 to 2026 into CSVs under --data.

The 2026 races come from AP's live results files, with Wikipedia filling only the races AP lacks.

Writes candidates.csv and races.csv (2014 to 2026), baseline_candidates.csv and baseline_races.csv (2008 to 2013), the
presidential_lean.csv, senate_delegation.csv, and turnout.csv lookups, and load_report.txt.
Every row cites its source by `source_id` in sources.csv, which holds each source's name and fetch time once.
Run with `uv run pull.py`. Sources are cached in .cache/ for 30 days; `--refresh 2026` refetches only 2026 sources.
"""

import argparse
import json
import sys
import urllib.error
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from lib.ap import ApPull, keep_uncovered, parse_ap  # noqa: E402
from lib.enrich import (  # noqa: E402
    GovernorIncumbent,
    GovernorKey,
    flag_incumbent_candidates,
    governor_incumbency,
    house_incumbency,
    mark_redrawn,
    presidential_lean,
    senate_delegation,
    senate_incumbency,
)
from lib.legislators import Term, general_election_day, parse_legislators  # noqa: E402
from lib.medsl import parse_medsl, parse_medsl_president  # noqa: E402
from lib.model import BASELINE_START, LATEST_CYCLE, STATE_CODES, WINDOW_START, CandidateRow, RaceRow, SourceFormatError  # noqa: E402
from lib.output import write_csvs  # noqa: E402
from lib.races import apply_overrides, collapse_to_races, read_overrides  # noqa: E402
from lib.source_table import SourceTable, with_source_id  # noqa: E402
from lib.sources import SetupError, Sources  # noqa: E402
from lib.turnout import TurnoutRow, parse_turnout  # noqa: E402
from lib.wikipedia import governor_incumbent, governor_titles, house_titles, parse_2026_page, parse_governor_page, senate_titles  # noqa: E402

OFFICES = ("house", "senate", "governor")


def pull_wikipedia(sources: Sources) -> tuple[list[CandidateRow], list[str], dict[GovernorKey, GovernorIncumbent]]:
    """Governors for every year from 2008 to 2026 and the 2026 Senate and House races, the races that could not be read, and each
    governor race's officeholder going in."""
    rows: list[CandidateRow] = []
    skipped: list[str] = []
    incumbents: dict[GovernorKey, GovernorIncumbent] = {}

    seen: set[str] = set()  # resolved titles, so a redirect to a page already read adds nothing

    def read(title: str, year: int, parse: str) -> None:
        payload = sources.wikipedia_page(title, year)
        at = sources.wikipedia_fetched_at(title, year)
        resolved = payload.get("parse", {}).get("title") if isinstance(payload.get("parse"), dict) else None
        if isinstance(resolved, str):
            if resolved in seen:
                return
            seen.add(resolved)
        try:
            found, notes = parse_governor_page(payload, year, at) if parse == "governor" else parse_2026_page(payload, "senate" if parse == "senate" else "house", at)
        except SourceFormatError as e:
            skipped.append(f"{title}: {str(e).removeprefix('Wikipedia: ')}")
            return
        rows.extend(found)
        skipped.extend(notes)
        held = governor_incumbent(payload) if parse == "governor" else None
        if held is not None:
            key, name, party = held
            incumbents[key] = GovernorIncumbent(name, party)

    def overview(title: str, year: int) -> dict[str, object] | None:
        payload = sources.wikipedia_page(title, year)
        if "parse" not in payload:
            skipped.append(f"{title}: overview page not found, so its races were not read")
            return None
        return payload

    for year in range(BASELINE_START, LATEST_CYCLE + 1):
        page = overview(f"{year} United States gubernatorial elections", year)
        for title in governor_titles(page, year) if page else []:
            read(title, year, "governor")
    page = overview(f"{LATEST_CYCLE} United States Senate elections", LATEST_CYCLE)
    for title in senate_titles(page, LATEST_CYCLE) if page else []:
        read(title, LATEST_CYCLE, "senate")
    for title in house_titles(LATEST_CYCLE):
        read(title, LATEST_CYCLE, "house")
    return rows, skipped, incumbents


def pull_ap(sources: Sources) -> ApPull:
    """The 2026 House, Senate, and governor races from the AP national metadata and progress files."""
    paths = sources.ap_results(general_election_day(LATEST_CYCLE).isoformat(), LATEST_CYCLE)
    payloads: list[object] = []
    for path in paths:
        try:
            payloads.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            path.unlink(missing_ok=True)
            raise SourceFormatError(f"AP {path.name}", f"not JSON ({e}); the cached copy was removed, so a rerun fetches it again") from e
    metadata, progress = payloads
    return parse_ap(metadata, progress, LATEST_CYCLE, sources.fetched_at(paths[1]))


def read_legislators(sources: Sources) -> list[Term]:
    paths = sources.legislators()
    payloads: list[object] = []
    for path in paths:
        try:
            payloads.append(json.loads(path.read_text(encoding="utf-8")))
        except json.JSONDecodeError as e:
            raise SourceFormatError(path.name, f"not JSON ({e})") from e
    return parse_legislators(payloads, " and ".join(p.name for p in paths))


def read_turnout(sources: Sources) -> list[TurnoutRow]:
    rows: list[TurnoutRow] = []
    for year, path in sources.election_lab_turnout():
        rows += parse_turnout(path, year, f"UF Election Lab, {path.name}")
    latest = {(r.state, r.year): r for r in rows if r.year >= BASELINE_START}  # a later file's year replaces the same year in an earlier one
    return [latest[key] for key in sorted(latest)]


def enrich(races: list[RaceRow], candidates: list[CandidateRow], terms: list[Term], governors: dict[GovernorKey, GovernorIncumbent], redistricting: Path, table: SourceTable) -> list[RaceRow]:
    races = senate_incumbency(races, candidates, terms)
    races = house_incumbency(races, candidates, terms)
    races = governor_incumbency(races, candidates, governors)
    return mark_redrawn(races, redistricting, table)


def load_report(races: list[RaceRow], skipped: list[str], overrides: Path, overridden: int, turnout_years: list[int] | None = None, eevp: list[str] | None = None) -> str:
    counts = Counter((r.year, r.office) for r in races)
    lines = [
        f"Load report, written {datetime.now(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')}",
        "",
        "Races per year and office, baseline years included (specials and runoffs counted once per race):",
        f"{'year':>6} {'house':>6} {'senate':>6} {'governor':>8}",
        *(f"{year:>6} {counts[(year, 'house')]:>6} {counts[(year, 'senate')]:>6} {counts[(year, 'governor')]:>8}" for year in sorted({y for y, _ in counts})),
        "",
        f"Races decided or corrected by {overrides.name}: {overridden}",
        f"Election Lab turnout years: {', '.join(str(y) for y in turnout_years or []) or 'none'}",
        "",
        f"Races not read, or read only in part ({len(skipped)}). None of these is written with zeros:",
        *(f"- {line}" for line in skipped),
        "",
        f"AP races counted below 100 percent of their expected vote ({len(eevp or [])}). They are written with the partial counts:",
        *(f"- {line}" for line in eevp or []),
    ]
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=(__doc__ or "").split("\n")[0])
    ap.add_argument("--data", type=Path, default=HERE / "data", help="data folder: writes the CSVs and load_report.txt here, and reads overrides/ and sources.csv (default data/)")
    ap.add_argument("--cache", type=Path, default=HERE / ".cache", help="source download cache (default .cache/)")
    ap.add_argument("--refresh", type=int, action="append", default=[], metavar="YEAR", help="refetch the sources scoped to YEAR, repeatable")
    ap.add_argument("--max-age-days", type=int, default=30, help="refetch cached sources older than this (default 30)")
    args = ap.parse_args(argv)
    sources = Sources(args.cache, set(args.refresh), args.max_age_days)
    data: Path = args.data
    overrides, redistricting, sources_csv = data / "overrides" / "result_overrides.csv", data / "overrides" / "redistricting.csv", data / "sources.csv"
    table = SourceTable.load(sources_csv)
    years = list(range(BASELINE_START, LATEST_CYCLE + 1))
    try:
        senate, house = sources.medsl_senate(), sources.medsl_house()
        candidates = parse_medsl(senate, "senate", sources.fetched_at(senate)) + parse_medsl(house, "house", sources.fetched_at(house))
        ap = pull_ap(sources)
        wiki, skipped, governors = pull_wikipedia(sources)
        wiki, skipped = keep_uncovered(wiki, skipped, {(c.year, c.state, c.office, c.seat, c.special) for c in ap.rows})
        skipped = ap.notes + skipped
        candidates = apply_overrides(candidates + ap.rows + wiki, overrides, table)
        terms = read_legislators(sources)
        president = parse_medsl_president(sources.medsl_president())
        turnout = read_turnout(sources)
        window = [c for c in candidates if c.year >= WINDOW_START]
        baseline = [c for c in candidates if c.year < WINDOW_START]
        races = enrich(collapse_to_races(window), window, terms, governors, redistricting, table)
        baseline_races = enrich(collapse_to_races(baseline), baseline, terms, governors, redistricting, table)
    except (SetupError, SourceFormatError) as e:
        print(f"pull.py: {e}", file=sys.stderr)
        return 1
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"pull.py: a download failed ({e}). Nothing was written; rerun to resume from the cache.", file=sys.stderr)
        return 1
    window, baseline = flag_incumbent_candidates(window, races), flag_incumbent_candidates(baseline, baseline_races)
    lean = presidential_lean(president, years)
    elections = [(state, general_election_day(year)) for year in years for state in sorted(STATE_CODES.values())]
    delegation = senate_delegation(terms, elections)
    missing_delegations = sorted({(str(s), d.isoformat()) for s, d in elections} - {(str(r["state"]), str(r["election_date"])) for r in delegation})
    skipped += [f"{state} senate delegation on {day}: fewer than two senators in the legislators files, so no row" for state, day in missing_delegations]
    overridden = len({(c.year, c.state, c.office, c.seat, c.special) for c in read_overrides(overrides, table)})
    write_csvs(
        data,
        candidates=with_source_id(window, table),
        races=with_source_id(races, table),
        baseline_candidates=with_source_id(baseline, table),
        baseline_races=with_source_id(baseline_races, table),
        presidential_lean=list(lean),
        senate_delegation=list(delegation),
        turnout=with_source_id(turnout, table),
    )
    table.write(sources_csv)
    report = data / "load_report.txt"
    partial = report.with_name(".load_report.txt.partial")
    partial.write_text(load_report(baseline_races + races, skipped, overrides, overridden, sorted({r.year for r in turnout}), ap.eevp))
    partial.replace(report)
    print(f"{data}: {len(window)} candidates, {len(races)} races, {len(baseline_races)} baseline races, {len(skipped)} races in load_report.txt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
