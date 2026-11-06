#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["duckdb>=1.4", "numpy>=2", "jsonschema>=4.23"]
# ///
"""Write out/findings.json, one auditable file of enumerated findings with their inputs, rules, numbers, and evidence.

Run: `uv run findings.py` after `uv run analyze.py`. `--check FILE` validates an existing file and writes nothing.
The labels are computed in Python from the answer CSVs by lib/findings_rules.py. DuckDB only lists the races in each fit or group.
The file is written to a temporary name and renamed, so a failed run leaves an earlier findings.json untouched.
"""

import argparse
import ast
import csv
import hashlib
import io
import json
import os
import platform
import statistics
import subprocess
import sys
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from importlib.metadata import version
from pathlib import Path
from typing import Any, cast

import duckdb
import jsonschema
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from lib import findings_format as fmt  # noqa: E402
from lib import findings_rules as rules  # noqa: E402
from lib.ap import RaceProgress, progress_by_race  # noqa: E402
from lib.legislators import general_election_day  # noqa: E402
from lib.model import LATEST_CYCLE  # noqa: E402
from lib.source_table import SourceTable, join_sources  # noqa: E402

SCHEMA_PATH = HERE / "findings.schema.json"
SCHEMA_VERSION = 1
ANSWERS = ("seat_change_2026.csv", "seat_change_2026_by_lean.csv", "incumbency_presidential_lean.csv", "turnout_k.csv", "dummymander.csv", "dummymander_party.csv", "dummymander_test.csv")
PULLED = ("races.csv", "candidates.csv", "load_report.txt")
DATABASE = "elections.duckdb"
LEAN_COLUMNS: dict[rules.LeanDef, str] = {"presidential": "presidential_lean"}

Row = dict[str, str]
Json = dict[str, Any]


class MissingInput(Exception):
    """findings.py missing file"""


@dataclass
class InputFile:
    path: Path
    sha256: str
    bytes: int
    rows: int


@dataclass
class Inputs:
    data: Path
    answers: dict[str, list[Row]]
    races: list[Row]
    candidates: list[Row]
    load_report: str
    database: Path
    progress: dict[rules.RaceKeyText, RaceProgress] = field(default_factory=lambda: {})
    progress_fetched_at: str | None = None
    files: list[InputFile] = field(default_factory=lambda: [])


def load_inputs(data: Path, out: Path, cache: Path) -> Inputs:
    """Reads and hashes every input once. Raises MissingInput for an absent CSV or database."""
    files: list[InputFile] = []

    def read(path: Path, command: str) -> bytes:
        if not path.exists():
            raise MissingInput(f"findings.py: {path} is missing. Run `{command}` first.")
        return path.read_bytes()

    def csv_rows(path: Path, command: str) -> list[Row]:
        data = read(path, command)
        rows = list(csv.DictReader(io.StringIO(data.decode("utf-8"))))
        files.append(InputFile(path, _sha256(data), len(data), len(rows)))
        return rows

    analyze, pull = f"uv run analyze.py --data {data} --out {out}", f"uv run pull.py --data {data}"
    answers = {name: csv_rows(data / "answers" / name, analyze) for name in ANSWERS}
    sources_path = data / "sources.csv"
    sources_bytes = read(sources_path, pull)
    files.append(InputFile(sources_path, _sha256(sources_bytes), len(sources_bytes), sources_bytes.count(b"\n") - 1))
    table = SourceTable.load(sources_path)
    races = join_sources(csv_rows(data / "races.csv", pull), table)
    candidates = join_sources(csv_rows(data / "candidates.csv", pull), table)
    report = read(data / "load_report.txt", pull)
    files.append(InputFile(data / "load_report.txt", _sha256(report), len(report), report.count(b"\n")))
    database = out / DATABASE
    db_bytes = read(database, analyze)
    files.append(InputFile(database, _sha256(db_bytes), len(db_bytes), _database_rows(database)))
    inputs = Inputs(data, answers, races, candidates, report.decode("utf-8"), database, files=files)
    day = general_election_day(LATEST_CYCLE).isoformat()
    meta_path, prog_path = cache / "ap" / day / "metadata.json", cache / "ap" / day / "progress.json"
    if meta_path.exists() and prog_path.exists():
        payloads: list[object] = []
        for path in (meta_path, prog_path):
            raw = path.read_bytes()
            payload: object = json.loads(raw)
            payloads.append(payload)
            keys = len(cast("dict[str, object]", payload)) if isinstance(payload, dict) else 0
            files.append(InputFile(path, _sha256(raw), len(raw), keys))
        by_key = progress_by_race(payloads[0], payloads[1], LATEST_CYCLE)
        inputs.progress = {rules.race_key_of(*key): value for key, value in by_key.items()}
        inputs.progress_fetched_at = _mtime(prog_path)
    return inputs


def describe_inputs(inputs: Inputs, root: Path = HERE) -> list[Json]:
    """Every input as path (relative to `root`, the pages/election_results folder), sha256, bytes, and data rows."""
    return [{"path": os.path.relpath(f.path.resolve(), root), "sha256": f.sha256, "bytes": f.bytes, "rows": f.rows} for f in inputs.files]


def counts_2026(races: Sequence[Mapping[str, str]], progress: Mapping[str, RaceProgress]) -> dict[str, rules.Counts2026]:
    """Per office: 2026 races, AP races, unofficial and certified counts, and the AP expected vote figures."""
    result: dict[str, rules.Counts2026] = {}
    for office in rules.OFFICES:
        rows = [r for r in races if r["year"] == rules.YEAR and r["office"] == office]
        ap = [r for r in rows if r["source"] == "ap"]
        found = [progress.get(rules.race_key(r)) for r in ap]
        eevps = [p.eevp for p in found if p is not None and p.eevp is not None]
        updates = [p.last_updated for p in found if p is not None and p.last_updated]
        result[office] = {
            "races": len(rows),
            "ap_races": len(ap),
            "unofficial": sum(r["official"] != "true" for r in rows),
            "certified": sum(r["official"] == "true" for r in rows),
            "eevp_below_100": sum(e < 100 for e in eevps),
            "eevp_below_95": sum(e < rules.THRESHOLDS.nearly_complete_eevp for e in eevps),
            "eevp_unknown": len(ap) - len(eevps),
            "eevp_min": min(eevps) if eevps else None,
            "eevp_median": statistics.median(eevps) if eevps else None,
            "latest_update": max(updates) if updates else None,
        }
    return result


def sources(inputs: Inputs) -> list[Json]:
    """The fetch time of each source in candidates.csv (Wikipedia pages as one source), the AP progress file, and the load report."""
    by_source: dict[str, list[str]] = {}
    for r in inputs.candidates:
        name = "Wikipedia" if r.get("source", "").startswith("Wikipedia") else r.get("source", "")
        by_source.setdefault(name or "unknown", []).append(r.get("fetched_at", ""))
    found: list[Json] = []
    for name in sorted(by_source):
        stamps = sorted(s for s in by_source[name] if s)
        found.append({"name": f"candidates.csv: {name}", "fetched_at": stamps[-1] if stamps else None, "earliest": stamps[0] if stamps else None, "rows": len(by_source[name])})
    found.append({"name": "AP progress.json", "fetched_at": inputs.progress_fetched_at})
    first = inputs.load_report.split("\n", 1)[0]
    found.append({"name": "load_report.txt written", "fetched_at": first.rsplit(" ", 1)[-1] if first.startswith("Load report, written") else None})
    return found


@dataclass(frozen=True)
class SourceEntry:
    """One data source in the page's overview. `match` picks its rows in candidates.csv by `source` prefix, or None when absent."""

    name: str
    supplies: str
    location: str
    notes: str
    match: str | None = None


SOURCE_CATALOG: tuple[SourceEntry, ...] = (
    SourceEntry(
        "AP Elections live results for 2026-11-03",
        "House, Senate, and governor results for 2026, with each race's expected vote percentage and certification status.",
        "https://interactives.apelections.org/election-results/data-live/2026-11-03/results/national/",
        "",
        "ap",
    ),
    SourceEntry(
        "MEDSL, U.S. House 1976 to 2024",
        "U.S. House results from 2008 to 2024.",
        "https://doi.org/10.7910/DVN/IG0UN2",
        "Runoffs and gaps are filled from data/overrides/result_overrides.csv.",
        "MEDSL U.S. House",
    ),
    SourceEntry(
        "MEDSL, U.S. Senate statewide 1976 to 2024",
        "U.S. Senate results from 2008 to 2024.",
        "https://doi.org/10.7910/DVN/PEJ5QU",
        "Special election classes are assigned in lib/medsl.py.",
        "MEDSL U.S. Senate",
    ),
    SourceEntry(
        "Wikipedia, election pages through the MediaWiki parse API",
        "Governor results from 2008 to 2025, 2026 governor incumbents, other misc data.",
        "https://en.wikipedia.org/w/api.php",
        "",
        "Wikipedia",
    ),
    SourceEntry(
        "MEDSL, U.S. President 1976 to 2024",
        "The presidential lean of each state.",
        "https://doi.org/10.7910/DVN/42MVDX",
        "",
    ),
    SourceEntry(
        "unitedstates/congress-legislators",
        "House and Senate incumbency on each election day.",
        "https://unitedstates.github.io/congress-legislators/",
        "Independents are counted with their caucus party.",
    ),
    SourceEntry(
        "University of Florida Election Lab, general election turnout",
        "Statewide ballots counted and the voting eligible population, used by the turnout plausibility check.",
        "https://election.lab.ufl.edu/",
        "",
    ),
    SourceEntry(
        "Ballotpedia redistricting pages, through data/overrides/redistricting.csv",
        "The first election year of every census map and every mid cycle House map from 2012 to 2026.",
        "data/overrides/redistricting.csv",
        "Used to identify redrawn districts, census breaks in comparability, and the dummymander groups.",
    ),
    SourceEntry(
        "Hand entered result overrides, data/overrides/result_overrides.csv",
        "Runoffs, ranked choice final rounds, and races the MEDSL files lack or misreport.",
        "data/overrides/result_overrides.csv",
        "",
    ),
)

# The SQL files and analyze.py functions that implement each question, in the order they run.
QUESTION_SQL: dict[str, tuple[str, ...]] = {
    "seat_change": (
        "analyze.py:build_database",
        "sql/00_views.sql",
        "sql/10_seat_prior.sql",
        "sql/20_seat_change_2026.sql",
        "sql/22_seat_change_by_lean.sql",
        "analyze.py:run_sql_answer",
    ),
    "incumbency": (
        "sql/30_incumbency_view.sql",
        "analyze.py:write_incumbency",
        "analyze.py:fit_incumbency",
        "analyze.py:_controls",
        "analyze.py:_ols",
    ),
    "turnout": ("sql/40_turnout_k.sql", "sql/45_turnout_plausibility.sql", "analyze.py:run_sql_answer"),
    "dummymander": ("sql/30_incumbency_view.sql", "sql/50_dummymander.sql", "sql/55_dummymander_party.sql", "analyze.py:dummymander_test", "analyze.py:write_dummymander_test", "analyze.py:run_sql_answer"),
}
RAW_ROW_CAP = 50


def source_overview(inputs: Inputs) -> list[Json]:
    """Every source behind the answers, with what it supplies, where it lives, its latest fetch time and rows, and its caveats."""
    found: list[Json] = []
    for entry in SOURCE_CATALOG:
        rows = [r for r in inputs.candidates if entry.match is not None and r.get("source", "").startswith(entry.match)]
        stamps = sorted(r["fetched_at"] for r in rows if r.get("fetched_at"))
        fetched = stamps[-1] if stamps else (inputs.progress_fetched_at if entry.match == "ap" else None)
        found.append(
            {
                "name": entry.name,
                "supplies": entry.supplies,
                "location": entry.location,
                "fetched_at": fetched,
                "rows": len(rows) if entry.match is not None else None,
                "notes": entry.notes,
            }
        )
    return found


def question_sql(root: Path = HERE) -> dict[str, list[Json]]:
    """The exact text of each question's SQL files and analyze.py functions, with the sha256 of that text."""
    analyze_source = (root / "analyze.py").read_text(encoding="utf-8")
    functions = {node.name: ast.get_source_segment(analyze_source, node) or "" for node in ast.parse(analyze_source).body if isinstance(node, ast.FunctionDef)}
    found: dict[str, list[Json]] = {}
    for question, parts in QUESTION_SQL.items():
        entries: list[Json] = []
        for part in parts:
            if part.startswith("analyze.py:"):
                text, kind = functions[part.split(":", 1)[1]] + "\n", "python"
            else:
                text, kind = (root / part).read_bytes().decode("utf-8"), "sql"
            entries.append({"file": part, "kind": kind, "sha256": _sha256(text.encode("utf-8")), "text": text})
        found[question] = entries
    return found


def raw_results(inputs: Inputs, cap: int = RAW_ROW_CAP) -> dict[str, list[Json]]:
    """Each question's 2026 answer rows, rounded for display by column (fmt.raw_cell), at most `cap` rows per table, with the total row count."""

    def table(name: str, description: str, keep: Callable[[Row], bool]) -> Json:
        path = inputs.data / "answers" / name
        with path.open(encoding="utf-8", newline="") as handle:
            reader = csv.reader(handle)
            empty: list[str] = []
            columns = next(reader, empty)
            rows = [row for row in reader if keep(dict(zip(columns, row, strict=False)))]
        kinds = [fmt.RAW_COLUMN_KINDS.get(c) for c in columns]
        return {
            "source_file": os.path.relpath(path.resolve(), HERE),
            "filter": description,
            "columns": columns,
            "column_kinds": ["text" if k is None else "number" for k in kinds],
            "column_units": ["" if k is None else fmt.KIND_UNITS[k] for k in kinds],
            "rows": [[fmt.raw_cell(c, v) for c, v in zip(columns, row, strict=False)] for row in rows[:cap]],
            "total_rows": len(rows),
            "truncated": len(rows) > cap,
        }

    def in_2026(r: Row) -> bool:
        return r.get("year") == rules.YEAR

    def scope_2026(r: Row) -> bool:
        return r.get("year_scope") == rules.YEAR

    return {
        "seat_change": [
            table("seat_change_2026.csv", "Every 2026 race, in file order.", in_2026),
            table(rules.BY_LEAN_FILE, "Every 2026 race with its state's presidential lean, in file order.", in_2026),
        ],
        "incumbency": [
            table("incumbency_presidential_lean.csv", "The 2026 year scope rows, by office, presidential lean, and incumbent party.", scope_2026),
        ],
        "turnout": [table("turnout_k.csv", "The 2026 races, in file order.", in_2026)],
        "dummymander": [
            table("dummymander.csv", "Every year with a mid cycle House map, both groups.", lambda _: True),
            table("dummymander_party.csv", "Every year with a mid cycle House map, both groups, all races.", lambda _: True),
            table("dummymander_test.csv", "The 2014 to 2024 pooled figures and the 2026 test, for each basis.", lambda _: True),
        ],
    }


def questions(inputs: Inputs) -> Json:
    """Per question, the SQL and code that implement it and its raw 2026 results."""
    sql, raw = question_sql(), raw_results(inputs)
    return {q: {"sql": sql[q], "raw_results": raw[q]} for q in QUESTION_SQL}


def tool_versions() -> Json:
    """Python, DuckDB, numpy, and jsonschema versions, the sha256 of findings.py, and the repository commit when git has one."""
    try:
        commit: str | None = subprocess.run(["git", "rev-parse", "HEAD"], cwd=HERE, capture_output=True, text=True, check=True).stdout.strip() or None
    except (OSError, subprocess.CalledProcessError):
        commit = None
    return {
        "python": platform.python_version(),
        "duckdb": duckdb.__version__,
        "numpy": np.__version__,
        "jsonschema": version("jsonschema"),
        "findings_py_sha256": _sha256(Path(__file__).read_bytes()),
        "commit": commit,
    }


def build_findings(inputs: Inputs, tools: Json, th: rules.Thresholds = rules.THRESHOLDS, generated_at: str | None = None) -> Json:
    """The findings.json object for one run."""
    counts = counts_2026(inputs.races, inputs.progress)
    ap_fetched = max((r["fetched_at"] for r in inputs.candidates if r.get("source") == "ap" and r.get("fetched_at")), default=None)
    claims = _claims(inputs, counts, ap_fetched or inputs.progress_fetched_at, th)
    return {
        "schema_version": SCHEMA_VERSION,
        "run": {
            "generated_at": generated_at or datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "tools": tools,
            "inputs": describe_inputs(inputs),
            "sources": sources(inputs),
            "counts_2026": counts,
        },
        "sources": source_overview(inputs),
        "questions": questions(inputs),
        "thresholds": th.as_json(),
        "rules": rules.rule_text(th),
        "selectors": {key: claim["value"] for key, claim in claims.items()},
        "claims": claims,
    }


def validate(findings: object, schema: Json | None = None) -> list[str]:
    """The problems with a findings object, empty when it is valid: schema errors, then the selector key set and claim checks."""
    validator = jsonschema.Draft202012Validator(schema if schema is not None else load_schema())
    errors: list[jsonschema.ValidationError] = list(validator.iter_errors(cast("Any", findings)))  # pyright: ignore[reportUnknownMemberType]
    problems = [f"{'/'.join(str(p) for p in e.absolute_path) or '(root)'}: {e.message}" for e in errors]
    if problems or not isinstance(findings, dict):
        return problems
    data = cast("Json", findings)
    selectors = cast("dict[str, str]", data["selectors"])
    claims = cast("dict[str, Json]", data["claims"])
    expected = set(rules.selector_keys())
    if missing := sorted(expected - set(selectors)):
        problems.append(f"selectors: missing {', '.join(missing)}")
    if extra := sorted(set(claims) ^ set(selectors)):
        problems.append(f"claims and selectors differ on {', '.join(extra)}")
    for key, value in selectors.items():
        claim = claims.get(key)
        if claim is None:
            continue
        if claim["value"] != value:
            problems.append(f"claims/{key}: value {claim['value']} differs from its selector {value}")
        absent = [f for f in cast("list[str]", claim["trigger_fields"]) if f not in claim["display"]]
        if absent:
            problems.append(f"claims/{key}: trigger fields without a display string: {', '.join(absent)}")
    return problems


def load_schema() -> Json:
    return cast("Json", json.loads(SCHEMA_PATH.read_text(encoding="utf-8")))


def write_atomic(path: Path, findings: Json) -> None:
    """Writes `path` through a temporary file in the same folder and a rename, so a reader never sees a partial file."""
    partial = path.with_name(f".{path.name}.partial")
    try:
        partial.write_text(json.dumps(findings, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        os.replace(partial, path)
    finally:
        partial.unlink(missing_ok=True)


def check(path: Path) -> int:
    """Validates an existing findings file and writes nothing. Returns the exit status."""
    try:
        findings: object = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"findings.py: cannot read {path} ({e})", file=sys.stderr)
        return 1
    problems = validate(findings)
    for problem in problems:
        print(f"findings.py: {path}: {problem}", file=sys.stderr)
    if not problems:
        print(f"{path}: valid")
    return 1 if problems else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Write findings.json from the answer CSVs and the DuckDB file.")
    parser.add_argument("--data", type=Path, default=HERE / "data", help="folder holding the pulled CSVs, sources.csv, and answers/ (default data/)")
    parser.add_argument("--cache", type=Path, default=HERE / ".cache", help="source download cache holding the AP progress file (default .cache/)")
    parser.add_argument("--out", type=Path, default=HERE / "out", help="folder holding elections.duckdb, where findings.json is written (default out/)")
    parser.add_argument("--check", type=Path, metavar="FILE", help="validate FILE and write nothing")
    args = parser.parse_args(argv)
    if args.check is not None:
        return check(args.check)
    out: Path = args.out
    try:
        inputs = load_inputs(args.data, out, args.cache)
    except MissingInput as e:
        print(e, file=sys.stderr)
        return 1
    findings = build_findings(inputs, tool_versions())
    problems = validate(findings)
    if problems:
        for problem in problems:
            print(f"findings.py: {problem}", file=sys.stderr)
        print(f"findings.py: {out / 'findings.json'} was not written", file=sys.stderr)
        return 1
    write_atomic(out / "findings.json", findings)
    for key, value in findings["selectors"].items():
        print(f"{key}: {value}")
    return 0


def _claims(inputs: Inputs, counts: Mapping[str, rules.Counts2026], fetched_at: str | None, th: rules.Thresholds) -> dict[str, rules.Claim]:
    seat, turnout = inputs.answers["seat_change_2026.csv"], inputs.answers["turnout_k.csv"]
    by_lean = inputs.answers[rules.BY_LEAN_FILE]
    fits, dummies, party_races = _fit_races(inputs.database)
    ap_keys = {rules.race_key(r) for r in inputs.races if r["year"] == rules.YEAR and r["source"] == "ap"}
    counting = sorted(k for k in ap_keys if (p := inputs.progress.get(k)) is None or p.eevp is None or p.eevp < th.nearly_complete_eevp)
    found: dict[str, rules.Claim] = {"completeness": _with_races(rules.completeness(counts, fetched_at, th), counting)}
    for office in rules.OFFICES:
        found[f"seat_shift.{office}"] = rules.seat_shift(seat, office, th)
        found[f"party_flips.{office}"] = rules.party_flips(seat, office, th)
        for lean in rules.PRESIDENTIAL_LEANS:
            found[f"seat_shift_by_lean.{office}.{lean}"] = rules.seat_shift_by_lean(by_lean, office, lean, th)
            found[f"party_flips_by_lean.{office}.{lean}"] = rules.party_flips_by_lean(by_lean, office, lean, th)
        found[f"turnout_explanation.{office}"] = rules.turnout_explanation(turnout, office, th)
        found[f"k_direction.{office}"] = rules.k_direction(turnout, office, th)
    for group in rules.groups():
        rows = inputs.answers[rules.LEAN_FILES[group.leandef]]
        races = fits.get(group.key, [])
        found[f"incumbency_party_gap.{group.key}"] = _with_races(rules.incumbency_party_gap(rows, group, th), races)
        found[f"significance.{group.key}"] = _with_races(rules.significance(rows, group, th), races)
        for party in rules.PARTIES:
            found[f"bonus_vs_history.{group.key}.{party}"] = rules.bonus_vs_history(rows, group, party, th)
    dummy = inputs.answers["dummymander.csv"]
    found["dummymander.house"] = _with_races(rules.dummymander(dummy, th), dummies)
    found["dummymander_vs_history.house"] = rules.dummymander_vs_history(dummy, th)
    found["dummymander_party.house"] = _with_races(rules.dummymander_party(inputs.answers["dummymander_party.csv"], th), party_races)
    for basis in rules.DUMMY_BASES:
        found[f"dummymander_test.{basis}"] = rules.dummymander_test(inputs.answers["dummymander_test.csv"], basis, th)
    return {key: with_cells(found[key]) for key in rules.selector_keys()}


def with_cells(claim: rules.Claim) -> rules.Claim:
    """Adds `cells`: each number of the claim at its table precision with no unit, or null, for the page's number tables."""
    cells = {name: fmt.cell(fmt.CELL_KINDS[name], value) for name, value in claim["numbers"].items() if name in fmt.CELL_KINDS}
    return {**claim, "cells": cells}


def _fit_races(database: Path) -> tuple[dict[str, list[str]], list[str], list[str]]:
    """The race keys of each 2026 incumbency fit (by group key), of the 2026 incumbent dummymander groups, and of all 2026 House races, from incumbency_input."""
    con = duckdb.connect(str(database), read_only=True)
    try:
        cursor = con.execute(
            "select year, state, office, seat, special, presidential_lean, inc_dem or inc_rep as incumbent from incumbency_input "
            "where year = ? and dem_share is not null and prior_dem_share is not null order by state, office, seat, special",
            [int(rules.YEAR)],
        )
        names = [d[0] for d in cursor.description]
        rows: list[dict[str, Any]] = [dict(zip(names, values, strict=True)) for values in cursor.fetchall()]
    finally:
        con.close()
    fits: dict[str, list[str]] = {}
    dummies: list[str] = []
    party: list[str] = []
    for r in rows:
        key = rules.race_key_of(int(r["year"]), str(r["state"]), str(r["office"]), int(r["seat"]), bool(r["special"]))
        for leandef, column in LEAN_COLUMNS.items():
            if r[column] is not None:
                fits.setdefault(f"{leandef}.{r['office']}.{r[column]}", []).append(key)
        if r["office"] == "house":
            party.append(key)
            if r["incumbent"]:
                dummies.append(key)
    return fits, dummies, party


def _with_races(claim: rules.Claim, races: list[str]) -> rules.Claim:
    return {**claim, "evidence": [*claim["evidence"], *races]}


def _database_rows(path: Path) -> int:
    con = duckdb.connect(str(path), read_only=True)
    try:
        tables = [t for (t,) in con.execute("select table_name from information_schema.tables where table_type = 'BASE TABLE' order by table_name").fetchall()]
        total = 0
        for table in tables:
            found = con.execute(f'select count(*) from "{table}"').fetchone()
            total += int(found[0]) if found else 0
        return total
    finally:
        con.close()


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _mtime(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, tz=UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


if __name__ == "__main__":
    sys.exit(main())
