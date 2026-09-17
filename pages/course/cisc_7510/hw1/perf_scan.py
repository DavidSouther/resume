#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["psycopg[binary]"]
# ///
"""Query loading, query running, and report writing for the db_hw_1 perf scan.

Docker lifecycle and schema/index migrations stay in run_perf_scan.sh; this
script only talks to the already-migrated, already-seeded database.

Subcommands:
    run-pass PASS_NAME   Run every homework query with EXPLAIN (ANALYZE, BUFFERS),
                          write plans/<query>_<PASS_NAME>.json, print "<query>,<plan_ms>,<exec_ms>"
                          per line to stdout.
    report                Combine the indexed/noindex pass CSVs into perf_results.csv
                          and PERF_REPORT.html, with a Mermaid plan diagram per query.
"""
import argparse
import html
import itertools
import json
import re
import sys
from pathlib import Path
from typing import Any

import psycopg

HERE = Path(__file__).resolve().parent


def load_queries(hw_sql: Path) -> list[tuple[str, str, str]]:
    """Parse "-- N. <question>" blocks, blank-line separated, into (name, question, query)."""
    blocks = hw_sql.read_text().split("\n\n")
    queries = []
    for block in blocks:
        lines = [line for line in block.splitlines() if line.strip()]
        if not lines or not lines[0].startswith("--"):
            continue
        m = re.match(r"--\s*(\d+)\.\s*(.*)", lines[0])
        if not m:
            continue
        num, question = m.groups()
        query = " ".join(lines[1:]).strip()
        queries.append((f"q{int(num):02d}", question, query))
    return queries


def connect(args):
    return psycopg.connect(
        host=args.host,
        port=args.port,
        user="postgres",
        password="postgres",
        dbname=args.dbname,
        autocommit=True,
    )


def run_pass(args):
    queries = load_queries(Path(args.hw_sql))
    plans_dir = Path(args.plans_dir)
    plans_dir.mkdir(parents=True, exist_ok=True)

    rows = []
    with connect(args) as conn:
        with conn.cursor() as cur:
            for name, _question, query in queries:
                print(f"  [{args.pass_name}] {name}...", file=sys.stderr)
                try:
                    cur.execute(f"explain (analyze, costs, verbose, buffers, format json) {query}")
                    plan_array = cur.fetchone()[0]
                    plan_text = json.dumps(plan_array, indent=2)
                    plan_ms = _extract(plan_array[0], "Planning Time")
                    exec_ms = _extract(plan_array[0], "Execution Time")
                except Exception as exc:
                    conn.rollback()
                    plan_text = json.dumps({"error": f"{type(exc).__name__}: {exc}"}, indent=2)
                    plan_ms = exec_ms = "ERROR"

                (plans_dir / f"{name}_{args.pass_name}.json").write_text(f"{plan_text}\n")
                rows.append((name, plan_ms, exec_ms))

    for name, plan_ms, exec_ms in sorted(rows):
        print(f"{name},{plan_ms},{exec_ms}")


def _extract(plan: dict[str, Any], label: str) -> str:
    value = plan.get(label)
    return f"{value:.3f}" if isinstance(value, (int, float)) else "ERROR"


def _read_pass_csv(path: Path) -> dict[str, tuple[str, str]]:
    rows = {}
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        name, plan_ms, exec_ms = line.split(",")
        rows[name] = (plan_ms, exec_ms)
    return rows


def _row_counts(args) -> str:
    tables = ["product", "customer", "purchase", "purchase_items"]
    lines = []
    with connect(args) as conn:
        with conn.cursor() as cur:
            for table in tables:
                cur.execute(f"select count(*) from {table}")
                lines.append(f"{table},{cur.fetchone()[0]}")
    return "\n".join(lines)


def _index_defs(create_indexes_sql: Path) -> list[str]:
    defs = []
    for line in create_indexes_sql.read_text().splitlines():
        m = re.match(
            r"create index if not exists (\S+) on (.+);", line.strip(), re.IGNORECASE
        )
        if m:
            name, on = m.groups()
            defs.append(f"- `{name}` on `{on}`")
    return sorted(defs)


def _column(rows: list[str]) -> str:
    """Render "label,value" lines as an aligned two-column table, like `column -s, -t`."""
    parsed = [row.split(",") for row in rows]
    width = max(len(row[0]) for row in parsed)
    return "\n".join(f"{row[0]:<{width}}  {row[1]}" for row in parsed)


def _node_label(node: dict[str, Any]) -> str:
    label = node.get("Node Type", "?")
    if node.get("Relation Name"):
        label += f" on {node['Relation Name']}"
    if node.get("Index Name"):
        label += f" ({node['Index Name']})"
    cost = node.get("Total Cost", 0)
    time = node.get("Actual Total Time", 0)
    return f"{label}\ncost={cost:.1f} time={time:.2f}ms"


def _mermaid_flowchart(root: dict[str, Any]) -> str:
    """Render one EXPLAIN plan tree as a Mermaid flowchart (top-down, root at top)."""
    counter = itertools.count()
    lines = ["flowchart TD"]

    def walk(node: dict[str, Any]) -> str:
        node_id = f"n{next(counter)}"
        label = _node_label(node).replace('"', "'")
        lines.append(f'  {node_id}["{label}"]')
        for child in node.get("Plans", []):
            child_id = walk(child)
            lines.append(f"  {node_id} --> {child_id}")
        return node_id

    walk(root)
    return "\n".join(lines)


def _pct(old: float, new: float) -> str:
    if not old:
        return "n/a"
    return f"{(new - old) / old * 100:+.1f}%"


_PAGE_CSS = """
  :root { color-scheme: light dark; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    max-width: 960px; margin: 0 auto; padding: 1.5rem 1rem 4rem;
    line-height: 1.5; color: #1a1a1a; background: #fff;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #e6e6e6; background: #1b1b1f; }
    table, th, td { border-color: #444 !important; }
    code, pre { background: #26262b !important; }
    a { color: #8ab4f8; }
  }
  h1 { margin-bottom: 0.25rem; }
  .meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
  code, pre {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    background: #f4f4f6; border-radius: 6px;
  }
  pre { padding: 0.75rem; overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #ddd; padding: 0.4rem 0.6rem; text-align: right; }
  th:first-child, td:first-child { text-align: left; }
  section.query { margin: 2.5rem 0; padding-top: 1.5rem; border-top: 1px solid #ddd; }
  .timing-summary { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin: 0.75rem 0; }
  .plans-flex { display: flex; flex-wrap: wrap; gap: 1.5rem; margin: 1rem 0; }
  .plan-col { flex: 1 1 320px; min-width: 0; }
  .plan-col h4 { margin: 0 0 0.5rem; }
  .plan-col pre.mermaid { background: transparent; padding: 0; }
  details { margin: 0.5rem 0; }
  summary { cursor: pointer; }
"""

_PAGE_SCRIPT = """
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  mermaid.initialize({ startOnLoad: true, theme: dark ? "dark" : "default" });
"""


def _timing_table_rows(
    names: list[str],
    indexed: dict[str, tuple[str, str]],
    noindex: dict[str, tuple[str, str]],
    csv_lines: list[str],
) -> str:
    rows = []
    for name in names:
        _, ie = indexed[name]
        _, ne = noindex[name]
        speedup = csv_lines[names.index(name) + 1].split(",")[-1]
        rows.append(f"<tr><td>{name}</td><td>{ie}</td><td>{ne}</td><td>{speedup}</td></tr>")
    return "\n".join(rows)


def _query_section(name: str, question: str, query: str, plans_dir: Path) -> str:
    indexed_json = plans_dir / f"{name}_indexed.json"
    noindex_json = plans_dir / f"{name}_noindex.json"
    indexed_plan = json.loads(indexed_json.read_text())[0]
    noindex_plan = json.loads(noindex_json.read_text())[0]

    diagrams = ""
    if "error" not in indexed_plan and "error" not in noindex_plan:
        summary = (
            f"Planning Time:  {noindex_plan.get('Planning Time', 0):.3f} ms -&gt; "
            f"{indexed_plan.get('Planning Time', 0):.3f} ms "
            f"({_pct(noindex_plan.get('Planning Time', 0), indexed_plan.get('Planning Time', 0))})<br>"
            f"Execution Time: {noindex_plan.get('Execution Time', 0):.3f} ms -&gt; "
            f"{indexed_plan.get('Execution Time', 0):.3f} ms "
            f"({_pct(noindex_plan.get('Execution Time', 0), indexed_plan.get('Execution Time', 0))})"
        )
        diagrams = f"""
    <div class="timing-summary">{summary}</div>
    <div class="plans-flex">
      <div class="plan-col">
        <h4>No index</h4>
        <pre class="mermaid">{_mermaid_flowchart(noindex_plan["Plan"])}</pre>
      </div>
      <div class="plan-col">
        <h4>Indexed</h4>
        <pre class="mermaid">{_mermaid_flowchart(indexed_plan["Plan"])}</pre>
      </div>
    </div>"""

    return f"""
  <section class="query" id="{name}">
    <h3>{name}: {html.escape(question)}</h3>
    <pre><code>{html.escape(query)}</code></pre>
    {diagrams}
    <details><summary>Indexed plan JSON</summary><pre><code>{html.escape(indexed_json.read_text())}</code></pre></details>
    <details><summary>No-index plan JSON</summary><pre><code>{html.escape(noindex_json.read_text())}</code></pre></details>
  </section>"""


def report(args):
    indexed = _read_pass_csv(Path(args.indexed_csv))
    noindex = _read_pass_csv(Path(args.noindex_csv))
    names = sorted(set(indexed) & set(noindex))

    csv_out = Path(args.csv_out)
    csv_lines = ["query,indexed_planning_ms,indexed_execution_ms,noindex_planning_ms,noindex_execution_ms,speedup"]
    for name in names:
        ip, ie = indexed[name]
        np_, ne = noindex[name]
        speedup = "n/a"
        try:
            if float(ie) > 0:
                speedup = f"{float(ne) / float(ie):.1f}x"
        except ValueError:
            pass
        csv_lines.append(f"{name},{ip},{ie},{np_},{ne},{speedup}")
    csv_out.write_text("\n".join(csv_lines) + "\n")

    row_counts = _row_counts(args)
    index_defs = _index_defs(Path(args.create_indexes_sql))
    plans_dir = Path(args.plans_dir)
    queries_by_name = {name: (question, query) for name, question, query in load_queries(Path(args.hw_sql))}

    index_defs_html = "\n".join(f"<li>{html.escape(d.lstrip('- '))}</li>" for d in index_defs)
    query_sections = "\n".join(
        _query_section(name, *queries_by_name[name], plans_dir) for name in names
    )

    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>db_hw_1 perf scan results</title>
<style>{_PAGE_CSS}</style>
</head>
<body>
<h1>db_hw_1 perf scan results</h1>
<p class="meta">Auto-generated by <code>run_perf_scan.sh</code> -- regenerate with <code>./run_perf_scan.sh</code>.
Do not hand-edit; the next run overwrites this file.</p>

<p>Scale: {args.scale} customers (see <code>fuzz.sql</code>)</p>
<pre><code>{html.escape(_column(row_counts.splitlines()))}</code></pre>

<p>Candidate indexes (created for the indexed pass, dropped for noindex, same seeded data both times):</p>
<ul>{index_defs_html}</ul>

<h2>Timings</h2>
<table>
<thead><tr><th>query</th><th>indexed exec (ms)</th><th>no-index exec (ms)</th><th>speedup</th></tr></thead>
<tbody>
{_timing_table_rows(names, indexed, noindex, csv_lines)}
</tbody>
</table>

<p>Raw data: <code>perf_results.csv</code>. Full <code>EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)</code> output for
every query, both passes: <code>plans/&lt;query&gt;_indexed.json</code> / <code>plans/&lt;query&gt;_noindex.json</code>.</p>

<h2>Plans</h2>
{query_sections}

<script type="module">{_PAGE_SCRIPT}</script>
</body>
</html>
"""
    Path(args.report_out).write_text(page)
    print(f"Wrote {csv_out}, {args.report_out}, and {2 * len(names)} plan files in {plans_dir}.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default="5433")
    parser.add_argument("--dbname", default="cisc7510_hw1")
    parser.add_argument("--hw-sql", default=str(HERE / "db_hw_1.sql"))
    parser.add_argument("--plans-dir", default=str(HERE / "plans"))
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run-pass")
    p_run.add_argument("pass_name")
    p_run.set_defaults(func=run_pass)

    p_report = sub.add_parser("report")
    p_report.add_argument("--indexed-csv", default="/tmp/pass_indexed.csv")
    p_report.add_argument("--noindex-csv", default="/tmp/pass_noindex.csv")
    p_report.add_argument("--create-indexes-sql", default=str(HERE / "create_indexes.sql"))
    p_report.add_argument("--scale", default="20000")
    p_report.add_argument("--csv-out", default=str(HERE / "perf_results.csv"))
    p_report.add_argument("--report-out", default=str(HERE / "PERF_REPORT.html"))
    p_report.set_defaults(func=report)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
