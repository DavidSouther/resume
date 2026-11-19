#!/usr/bin/env python3
"""Independent oracle for db_hw_7.sql: each query is checked against a Python computation
over the same table, for several (a, b) employee pairs, so edge cases are covered too.
Usage: verify_queries.py CONTAINER DB

db_hw_7.sql format, which load_queries depends on: a "-- question" line, then a contiguous
block of lines up to the next blank line is one query (extra "--" lines inside the block are
SQL comments). Queries appear in the same order as the entries in answers(). Literals 42 and
24 in the SQL stand for employees a and b and are substituted per case.
"""
import csv
import io
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
container, db = sys.argv[1], sys.argv[2]


def psql(sql: str) -> list[tuple[str, ...]]:
    out = subprocess.run(
        ["docker", "exec", "-i", container, "psql", "-U", "postgres", "-d", db,
         "-v", "ON_ERROR_STOP=1", "--csv", "-t", "-c", sql],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        raise RuntimeError(out.stderr)
    return [tuple(r) for r in csv.reader(io.StringIO(out.stdout))]


def load_queries() -> list[tuple[str, str]]:
    lines = (HERE / "db_hw_7.sql").read_text().splitlines()
    blocks, i = [], 0
    while i < len(lines):
        if lines[i].startswith("--"):
            q = lines[i][2:].strip()
            i += 1
            body = []
            while i < len(lines) and lines[i].strip():
                body.append(lines[i])
                i += 1
            blocks.append((q, "\n".join(body)))
        else:
            i += 1
    return blocks


rows = psql("select empid, fname, lname, managerid, employee_rank from employee")
emp = {int(r[0]): (r[1], r[2], int(r[3]) if r[3] else None, r[4]) for r in rows}
kids: dict[int, list[int]] = {}
for e, (_, _, m, _) in emp.items():
    if m is not None:
        kids.setdefault(m, []).append(e)


def row(e: int) -> tuple[str, ...]:
    return (str(e), emp[e][0], emp[e][1])


def chain(e: int) -> list[int]:
    """Managers of e, nearest first."""
    out, m = [], emp[e][2]
    while m is not None:
        out.append(m)
        m = emp[m][2]
    return out


def descendants(e: int) -> list[tuple[int, int]]:
    """(empid, level) for every report of e; direct reports are level 1."""
    out, frontier, lvl = [], kids.get(e, []), 1
    while frontier:
        out += [(k, lvl) for k in frontier]
        frontier = [c for k in frontier for c in kids.get(k, [])]
        lvl += 1
    return out


def answers(x: int, y: int) -> list[tuple[list[tuple[str, ...]], bool]]:
    """One entry per query in file order: (rows, unordered). unordered means the query has
    no ORDER BY, so rows are compared as a set."""
    up = chain(x)
    svp = next((i for i, m in enumerate(up) if emp[m][3] == "SVP"), None)
    john = next((m for m in up if emp[m][:2] == ("John", "Doe")), None)
    a, b = [x] + up, [y] + chain(y)
    common = min((m for m in a if m in b), key=lambda m: a.index(m) + b.index(m))
    # Message route: up from x to the common manager, then down to y. Sequence starts at 0,
    # while manager paths start at 1 (the first manager), hence the different offsets.
    route = a[: a.index(common) + 1] + list(reversed(b[: b.index(common)]))
    to_john = up[: up.index(john) + 1] if john in up else []
    return [
        ([row(emp[x][2])] if up else [], False),
        ([row(k) for k in kids.get(x, [])], True),
        ([row(k) for k, _ in descendants(x)], True),
        ([(str(len(descendants(x))),)], False),
        ([row(m) for m in up], True),
        ([row(up[svp])] if svp is not None else [], False),
        ([(str(svp + 1),)] if svp is not None else [], False),
        ([(str(len(up)),)], False),
        ([(str(max((l for _, l in descendants(x)), default=0)),)], False),
        ([(str(i + 1),) + row(m) for i, m in enumerate(up)], False),
        ([(str(i + 1),) + row(m) for i, m in enumerate(to_john)], False),
        ([row(common)], False),
        ([(str(i),) + row(m) for i, m in enumerate(route)], False),
    ]


leaf = max(e for e in emp if e not in kids)
# Assignment pair, leaf, ancestor and descendant in both directions, and CEO.
cases = [(42, 24), (leaf, 24), (14, 42), (42, 14), (1, 24)]
queries = load_queries()
if len(queries) != len(answers(42, 24)):
    sys.exit(f"FAIL: found {len(queries)} queries in db_hw_7.sql, expected {len(answers(42, 24))}")

failed = 0
for x, y in cases:
    sub = {"42": str(x), "24": str(y)}
    for i, ((question, sql), (want, unordered)) in enumerate(zip(queries, answers(x, y)), 1):
        got = psql(re.sub(r"\b(42|24)\b", lambda m: sub[m.group(1)], sql).rstrip(";") + ";")
        ok = sorted(got) == sorted(want) if unordered else got == want
        failed += not ok
        print(f"({x},{y}) Q{i:<2} {'ok  ' if ok else 'FAIL'} rows={len(got):<5} {question}")
        if not ok:
            print(f"    want {want[:5]}\n    got  {got[:5]}")
sys.exit(1 if failed else 0)
