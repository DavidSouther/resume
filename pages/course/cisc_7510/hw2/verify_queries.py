#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["psycopg[binary]"]
# ///
"""Runs every non-blank query in db_hw_2.sql against the already-migrated, already-seeded
database and reports pass/fail + row count. No EXPLAIN, no timing, no report file -- this is
a sanity check that each query runs without erroring and returns plausible data, not a
benchmark. Docker lifecycle and schema/fuzz loading live in run_queries.sh.
"""
import argparse
import sys
from pathlib import Path

import psycopg

HERE = Path(__file__).resolve().parent


def load_queries(hw_sql: Path) -> list[tuple[str, str, str]]:
    """Parse "-- question" / query line pairs into (name, question, query).

    A run of leading "--" lines is the question; the non-comment, non-blank lines that
    follow (up to the next comment or blank line) are the query. Comments with no query
    text (still-blank homework answers) are skipped.
    """
    lines = hw_sql.read_text().splitlines()
    blocks: list[tuple[list[str], list[str]]] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("--"):
            question_lines = []
            while i < len(lines) and lines[i].strip().startswith("--"):
                question_lines.append(lines[i].lstrip("- ").strip())
                i += 1
            query_lines = []
            while i < len(lines) and lines[i].strip() and not lines[i].strip().startswith("--"):
                query_lines.append(lines[i].strip())
                i += 1
            blocks.append((question_lines, query_lines))
        else:
            i += 1

    queries = []
    n = 0
    for question_lines, query_lines in blocks:
        query = " ".join(query_lines).strip()
        if not query:
            continue
        n += 1
        queries.append((f"q{n:02d}", " ".join(question_lines), query))
    return queries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default="5434")
    parser.add_argument("--dbname", default="cisc7510_hw2")
    parser.add_argument("--hw-sql", default=str(HERE / "db_hw_2.sql"))
    args = parser.parse_args()

    queries = load_queries(Path(args.hw_sql))
    if not queries:
        print("No filled-in queries found in db_hw_2.sql.")
        return

    failures = 0
    with psycopg.connect(
        host=args.host, port=args.port, user="postgres", password="postgres",
        dbname=args.dbname, autocommit=True,
    ) as conn:
        with conn.cursor() as cur:
            for name, question, query in queries:
                try:
                    cur.execute(query)
                    if cur.description is None:
                        print(f"[ok]   {name} ({cur.statusmessage}): {question}")
                        continue
                    rows = cur.fetchall()
                    cols = [d.name for d in cur.description]
                    print(f"[ok]   {name} ({len(rows)} rows): {question}")
                    print(f"       {cols}")
                    for row in rows[:20]:
                        print(f"       {row}")
                    if len(rows) > 20:
                        print(f"       ... ({len(rows) - 20} more rows)")
                except Exception as exc:
                    failures += 1
                    conn.rollback()
                    print(f"[FAIL] {name}: {question}\n       {type(exc).__name__}: {exc}")

    if failures:
        print(f"\n{failures}/{len(queries)} quer{'y' if failures == 1 else 'ies'} failed.")
        sys.exit(1)
    print(f"\nAll {len(queries)} queries ran without error.")


if __name__ == "__main__":
    main()
