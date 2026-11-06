#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Write <out>/report/index.html presenting each answer CSV in <data>/answers/.

Run: `uv run report.py`. The page links each answer by its relative path from the report folder.
Nothing is written outside `<out>/report/`.
"""

import argparse
import csv
import os
import html
import statistics
import sys
from collections.abc import Callable
from pathlib import Path

HERE = Path(__file__).resolve().parent

Rows = list[dict[str, str]]
Answers = dict[str, Rows]

ANSWER_FILES: tuple[str, ...] = (
    "seat_change_2026.csv",
    "incumbency_presidential_lean.csv",
    "turnout_k.csv",
    "dummymander.csv",
)
ROW_CAP = 25

SEAT_COLUMNS = ("state", "office", "seat", "dem_candidate", "gop_candidate", "dem_pct", "gop_pct", "margin_change", "comparable", "redrawn")
TURNOUT_COLUMNS = (
    "year",
    "state",
    "office",
    "seat",
    "k",
    "flip_share",
    "required_extra_dem_votes",
    "comparison_change",
    "slack",
    "turnout_plausible",
)

CSS = """
:root { color-scheme: light dark; --fg: #1b1b1f; --bg: #ffffff; --muted: #55555e; --line: #c9c9d1; --head: #eeeef3; --link: #0b4fa8; --warn: #fff4d6; }
@media (prefers-color-scheme: dark) { :root { --fg: #ececf1; --bg: #16161a; --muted: #a8a8b3; --line: #3a3a44; --head: #25252c; --link: #8ab8ff; --warn: #3a3217; } }
body { margin: 0 auto; max-width: 64rem; padding: 1rem; background: var(--bg); color: var(--fg); font: 1rem/1.5 system-ui, sans-serif; }
a { color: var(--link); }
h1, h2 { line-height: 1.2; }
h2 { margin-top: 2.5rem; border-top: 1px solid var(--line); padding-top: 1rem; }
.notice { background: var(--warn); border: 1px solid var(--line); padding: 0.75rem 1rem; border-radius: 0.25rem; }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; font-size: 0.875rem; min-width: 100%; }
caption { text-align: left; color: var(--muted); padding-bottom: 0.25rem; }
th, td { border: 1px solid var(--line); padding: 0.25rem 0.5rem; text-align: left; white-space: nowrap; }
th { background: var(--head); }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
.note { color: var(--muted); font-size: 0.875rem; }
"""

SECTIONS: tuple[tuple[str, str], ...] = (
    ("seat_change_2026.csv", "Question 1: How did 2026 seats change from their prior election?"),
    ("incumbency_presidential_lean.csv", "Question 2: What is the incumbency bonus, by presidential lean?"),
    ("turnout_k.csv", "Question 3: Could turnout alone explain each shift?"),
    ("dummymander.csv", "Question 4: Did mid cycle redistricting hurt incumbents?"),
)


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def num(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def fmt(value: str) -> str:
    """Formats a number to at most three decimals, and leaves any other cell as it is."""
    n = num(value)
    if n is None or value in ("true", "false"):
        return value
    if n == int(n) and "." not in value:
        return str(int(n))
    return f"{n:.3f}".rstrip("0").rstrip(".")


def signed(value: float, digits: int = 2) -> str:
    return f"{value:+.{digits}f}"


def table(caption: str, columns: tuple[str, ...], rows: Rows) -> str:
    head = "".join(f'<th scope="col">{esc(c)}</th>' for c in columns)
    body: list[str] = []
    for row in rows:
        cells: list[str] = []
        for c in columns:
            raw = row.get(c, "")
            cells.append(f'<td class="num">{esc(fmt(raw))}</td>' if num(raw) is not None else f"<td>{esc(raw)}</td>")
        body.append(f"<tr>{''.join(cells)}</tr>")
    return (
        f'<div class="scroll" tabindex="0" role="region" aria-label="{esc(caption)}"><table><caption>{esc(caption)}</caption><thead><tr>{head}</tr></thead><tbody>{"".join(body)}</tbody></table></div>'
    )


def columns_of(rows: Rows, preferred: tuple[str, ...] | None = None) -> tuple[str, ...]:
    if preferred is not None:
        return tuple(c for c in preferred if c in rows[0])
    return tuple(rows[0])


ANSWERS_HREF = "../../data/answers"  # from out/report/ to data/answers/ in the default layout


def link(name: str, href: str = ANSWERS_HREF) -> str:
    return f'<a href="{esc(href)}/{esc(name)}">{esc(name)}</a>'


def seat_summary(rows: Rows) -> str:
    comparable = [r for r in rows if r.get("comparable") == "true"]
    redrawn = [r for r in rows if r.get("redrawn") == "true"]
    with_result = [r for r in comparable if num(r.get("margin_change")) is not None]
    text = f"The file covers {len(rows)} races in 2026. {len(comparable)} are comparable with their prior seat election, and {len(redrawn)} sit on a map redrawn since then. "
    if with_result:
        changes = [num(r["margin_change"]) or 0.0 for r in with_result]
        toward_dem = sum(1 for c in changes if c > 0)
        text += (
            f"Among {len(with_result)} comparable races with 2026 counts so far, the two party margin moved toward the Democrat in {toward_dem} "
            f"and toward the Republican in {len(changes) - toward_dem}, with a median change of {signed(statistics.median(changes), 1)} points (positive favors Democrats)."
        )
    else:
        text += "No comparable race has 2026 counts yet, so there is no margin change to report."
    return text


def incumbency_summary(rows: Rows) -> str:
    pooled = [r for r in rows if r.get("year_scope") == "pooled" and r.get("incumbent_party") in ("DEM", "REP")]
    parts: list[str] = []
    for office in ("house", "senate", "governor"):
        for party in ("DEM", "REP"):
            matches = [r for r in pooled if r["office"] == office and r["incumbent_party"] == party and num(r.get("regression_bonus")) is not None]
            if not matches:
                continue
            weighted = sum((num(r["regression_bonus"]) or 0.0) * (num(r["seats"]) or 0.0) for r in matches)
            seats = sum(num(r["seats"]) or 0.0 for r in matches)
            if seats:
                parts.append(f"{office} {party} {signed(weighted / seats, 1)}")
    if not parts:
        return "No office and party group has enough running incumbents to report a bonus."
    significant = [r for r in pooled if r["incumbent_party"] == "DEM" and (num(r.get("wald_p")) or 1.0) < 0.05]
    tail = (
        f" The Wald test of equal Democratic and Republican bonuses has p below 0.05 in {len(significant)} office and lean groups."
        if significant
        else " The Wald test of equal Democratic and Republican bonuses is not below 0.05 in any pooled office and lean group."
    )
    return (
        "A positive bonus is points of two party vote share an incumbent of that party gains over an open seat, averaged over lean groups weighted by seats "
        f"and pooled over years: {', '.join(parts)}." + tail
    )


def turnout_summary(rows: Rows) -> str:
    ks = [k for k in (num(r.get("k")) for r in rows) if k is not None]
    flags = [r["turnout_plausible"] for r in rows if r.get("turnout_plausible") in ("true", "false")]
    if not ks:
        return "No race has a turnout multiplier."
    text = f"The file has {len(ks)} races with a turnout multiplier k, with a median of {statistics.median(ks):.3f}. "
    if flags:
        plausible = flags.count("true")
        text += (
            f"Of {len(flags)} races with a statewide comparison, turnout alone is plausible for {plausible} and implausible for {len(flags) - plausible}. "
            "A race counts as implausible when the Democratic votes needed far exceed the real change in ballots."
        )
    else:
        text += "No race has a statewide ballot comparison yet."
    return text


def dummy_summary(rows: Rows) -> str:
    if not rows:
        return "No mid cycle states were found, so there is no redrawn group to compare."
    parts: list[str] = []
    for year in sorted({r["year"] for r in rows}):
        diff = next((num(r.get("difference")) for r in rows if r["year"] == year and num(r.get("difference")) is not None), None)
        counts = {r["group"]: r.get("races", "0") for r in rows if r["year"] == year}
        if diff is None:
            parts.append(f"{year}: too few races to compare ({counts.get('redrawn', '0')} redrawn, {counts.get('not_redrawn', '0')} elsewhere)")
        else:
            parts.append(f"{year}: {signed(diff, 1)} points ({counts.get('redrawn', '0')} redrawn, {counts.get('not_redrawn', '0')} elsewhere)")
    return (
        "Each value is the redrawn group's mean change in the incumbent party's two party share minus the same mean elsewhere that year. "
        "A negative value means incumbents in redrawn states did worse. " + "; ".join(parts) + "."
    )


TURNOUT_EXPLAINER = (
    "<h3>The plausibility columns</h3>"
    "<p>The multiplier k assumes every prior voter kept their side and only turnout moved. "
    "<code>required_extra_dem_votes</code> is how many Democratic ballots turnout alone would have to add (or remove) to produce the current two party share with Republican votes held fixed. "
    "<code>comparison_change</code> is the real change in ballots. On unchanged district lines it is the race's own change in votes cast. "
    "For a redrawn race the lines moved, so it is the statewide change in ballots scaled by the race's prior share of the state. "
    "<code>slack</code> is 2 percent of the prior two party votes, allowing for ballots that move between the top two candidates and others.</p>"
    "<p><code>turnout_plausible</code> is true when the required change is no larger than the real change plus slack. "
    "It is false when it is larger, and empty when the statewide comparison is not available, "
    "for example for 2026 before the Election Lab publishes turnout. A false value means turnout alone is not a believable explanation. "
    "It does not show that persuasion happened. <code>flip_share</code> gives the persuasion only reading of the same change.</p>"
)


def section(name: str, title: str, rows: Rows, href: str = ANSWERS_HREF) -> str:
    out: list[str] = [f'<section aria-labelledby="{esc(name)}-h"><h2 id="{esc(name)}-h">{esc(title)}</h2>']
    summarize: Callable[[Rows], str]
    if name == "seat_change_2026.csv":
        summarize = seat_summary
    elif name.startswith("incumbency"):
        summarize = incumbency_summary
    elif name == "turnout_k.csv":
        summarize = turnout_summary
    else:
        summarize = dummy_summary
    out.append(f"<p>{esc(summarize(rows))}</p>")
    if name == "turnout_k.csv":
        out.append(TURNOUT_EXPLAINER)
    out.append(f"<p>Full data: {link(name, href)} ({len(rows)} rows).</p>")
    shown = rows
    note = ""
    if name.startswith("incumbency"):
        shown = [r for r in rows if r.get("year_scope") == "pooled"]
        note = f"The table shows the {len(shown)} pooled rows. Rows for each election year are in the CSV."
    elif name == "turnout_k.csv":
        shown = sorted(rows, key=lambda r: -(num(r.get("year")) or 0))
        note = "The table lists the most recent years first."
    if not rows:
        out.append("<p>No mid cycle states, so this file has no rows.</p>" if name == "dummymander.csv" else "<p>This file has no rows.</p>")
    else:
        if len(shown) > ROW_CAP:
            note += f" Showing the first {ROW_CAP} of {len(shown)} rows. Open the CSV for the rest."
            shown = shown[:ROW_CAP]
        preferred = SEAT_COLUMNS if name == "seat_change_2026.csv" else TURNOUT_COLUMNS if name == "turnout_k.csv" else None
        out.append(table(title, columns_of(rows, preferred), shown))
        if note.strip():
            out.append(f'<p class="note">{esc(note.strip())}</p>')
    out.append("</section>")
    return "".join(out)


def render_page(answers: Answers, fetched_at: str = "", href: str = ANSWERS_HREF) -> str:
    latest = f" The latest source fetch was {esc(fetched_at)}." if fetched_at else ""
    parts: list[str] = [
        '<!doctype html><html lang="en"><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        f"<title>Election results report</title><style>{CSS}</style></head><body><main>",
        "<h1>Election results report, 2014 to 2026</h1>",
        f'<p class="notice" role="note"><strong>2026 numbers are unofficial and partial.</strong> '
        f"They come from Wikipedia pages that count votes as states report them, and they change until states certify.{latest}</p>",
        "<p>This page is a local view of the answer files. Each section summarizes one question in plain language, computed from its CSV, and links the file.</p>",
    ]
    for name, title in SECTIONS:
        parts.append(section(name, title, answers.get(name, []), href))
    parts.append("</main></body></html>")
    return "".join(parts)


def read_rows(path: Path) -> Rows:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def latest_fetch(data: Path) -> str:
    """The latest fetch time among the sources that candidates.csv cites."""
    path, sources = data / "candidates.csv", data / "sources.csv"
    if not path.exists() or not sources.exists():
        return ""
    cited = {r["source_id"] for r in read_rows(path)}
    return max((r["fetched_at"] for r in read_rows(sources) if r["source_id"] in cited), default="")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Write <out>/report/index.html from the answer CSVs.")
    parser.add_argument("--data", type=Path, default=HERE / "data", help="folder holding answers/, candidates.csv, and sources.csv (default data/)")
    parser.add_argument("--out", type=Path, default=HERE / "out", help="folder where report/index.html is written (default out/)")
    args = parser.parse_args(argv)
    out: Path = args.out
    answers: Answers = {}
    for name in ANSWER_FILES:
        path = args.data / "answers" / name
        if not path.exists():
            print(f"report.py: missing {path}. Run `uv run analyze.py --data {args.data}` first.", file=sys.stderr)
            return 1
        answers[name] = read_rows(path)
    target = out / "report" / "index.html"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(render_page(answers, latest_fetch(args.data), os.path.relpath(args.data / "answers", target.parent)), encoding="utf-8")
    print(f"{target}: {len(ANSWER_FILES)} answers")
    return 0


if __name__ == "__main__":
    sys.exit(main())
