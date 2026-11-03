#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["shgit @ git+https://github.com/davidsouther/shgit@3e2f481f9826552610c2b12a40b8b8a7f91a30c1"]
# ///
"""Check the actual homework SQL in a disposable PostgreSQL 16 Docker container."""

import argparse
import csv
import io
import math
import re
import shutil
import subprocess
import sys
import time
import uuid
from collections.abc import Sequence
from datetime import date, timedelta
from pathlib import Path

from shgit import Sh

# The script runs from its own directory, so the sibling import is intentional.
from generate_sample_data import render_sample_data  # pyright: ignore[reportImplicitRelativeImport]

HERE = Path(__file__).resolve().parent
NULL = "__HW6_NULL__"
# This is the reviewed file's complete statement order, including both view definitions.
LAYOUT = (
    (
        "q1",
        "SELECT COUNT(DISTINCT USERNAME) FROM DOORLOG WHERE EVENT = 'E' AND DOORID = 1",
    ),
    ("q2", "WITH LATEST AS"),
    ("presence", "CREATE VIEW PRESENCE AS"),
    (
        "q2b",
        "SELECT COUNT(DISTINCT USERNAME) FROM PRESENCE WHERE EXIT IS NULL AND ZONE = 2",
    ),
    (
        "q3",
        "SELECT COUNT(DISTINCT USERNAME) FROM PRESENCE WHERE EXIT IS NULL AND ZONE = 0",
    ),
    ("q4", "SELECT COUNT(DISTINCT USERNAME) FROM PRESENCE AS P"),
    ("occupancy", "CREATE VIEW OCCUPANCY AS"),
    ("q5", "SELECT G::DATE AS DAY, COUNT(O.USERNAME) AS OCCUPANCY"),
    ("q6", "WITH DAILY AS"),
    ("q7", "SELECT 100.0 * COUNT(DISTINCT USERNAME) FILTER (WHERE ZONE = 7)"),
    ("q8", "WITH DAYS AS"),
    ("q9", "SELECT 100.0 * COUNT(*) FILTER (WHERE LAST_EXIT >"),
    ("q10", "SELECT USERNAME FROM OCCUPANCY"),
)
VIEWS = {"presence", "occupancy"}
Rows = Sequence[Sequence[str | float | None]]


class TestFailure(Exception):
    pass


def load_statements() -> dict[str, str]:
    # Scoped to doors.sql: only -- line comments; quoted literals contain neither -- nor semicolons.
    sql = re.sub(r"--[^\n]*", "", (HERE / "doors.sql").read_text(encoding="utf-8"))
    statements = [part.strip() for part in sql.split(";") if part.strip()]
    if len(statements) != len(LAYOUT):
        raise TestFailure(
            f"doors.sql: expected {len(LAYOUT)} statements, found {len(statements)}"
        )
    result: dict[str, str] = {}
    for statement, (label, prefix) in zip(statements, LAYOUT):
        if not " ".join(statement.upper().split()).startswith(prefix):
            raise TestFailure(
                f"doors.sql: unexpected statement at {label}; review the 13-statement layout"
            )
        result[label] = statement
    return result


# Bracket mappings place options before the positional arguments; keyword arguments
# in the final call land after them, which is where psql's own options belong.
docker = Sh("docker", timeout=30)


class Postgres:
    def __init__(self, image: str) -> None:
        self.image: str = image
        self.name: str = f"cisc7510-hw6-{uuid.uuid4().hex}"
        self.container_id: str = ""
        self.attempted: bool = False

    @property
    def target(self) -> str:
        return self.container_id or self.name

    def start(self) -> None:
        if shutil.which("docker") is None:
            raise TestFailure("Docker CLI was not found on PATH.")
        self.attempted = True
        run = docker.run[
            {
                "detach": True,
                "rm": True,
                "network": "none",
                "name": self.name,
                "label": "cisc7510.hw6=tests",
                "env": {"POSTGRES_HOST_AUTH_METHOD": "trust", "TZ": "UTC"},
            }
        ](self.image, timeout=180, check=False)
        if run.returncode:
            raise TestFailure(
                f"{run.command} failed ({run.returncode}):\n{run.stderr.strip()}"
            )
        self.container_id = run.stdout.strip()
        if not re.fullmatch(r"[0-9a-f]{64}", self.container_id):
            self.container_id = ""
            raise TestFailure("docker run did not return a container ID")
        print(f"PostgreSQL container: {self.container_id[:12]}", flush=True)
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            ready = docker.exec(
                self.target,
                "pg_isready",
                "-h",
                "127.0.0.1",
                "-U",
                "postgres",
                "-d",
                "postgres",
                check=False,
                timeout=5,
            )
            if ready.returncode == 0:
                return
            time.sleep(0.25)
        raise TestFailure("PostgreSQL did not become ready within 45 seconds")

    def sql(self, sql: str) -> list[list[str]]:
        run = docker.exec[
            {"interactive": True, "env": {"PGOPTIONS": "-c timezone=UTC"}}
        ](
            self.target,
            "psql",
            X=True,
            username="postgres",
            dbname="postgres",
            set="ON_ERROR_STOP=1",
            csv=True,
            tuples_only=True,
            quiet=True,
            pset=f"null={NULL}",
            input=sql,
            check=False,
        )
        if run.returncode:
            detail = run.stderr.strip() or run.stdout.strip()
            raise TestFailure(f"{run.command} failed ({run.returncode}):\n{detail}")
        return list(csv.reader(io.StringIO(run.stdout)))

    def script(self, sql: str) -> None:
        """Run statements for their effect, discarding any rows."""
        _ = self.sql(sql)

    def logs(self) -> None:
        if self.attempted:
            run = docker.logs[{"tail": 60}](self.target, check=False)
            try:
                print(
                    "PostgreSQL container logs:\n" + run.stdout + run.stderr,
                    file=sys.stderr,
                )
            except (OSError, subprocess.SubprocessError) as error:
                print(f"Could not read container logs: {error}", file=sys.stderr)

    def close(self) -> bool:
        if not self.attempted:
            return True
        # The UUID name also covers a run interrupted before its ID was returned.
        run = docker.rm[{"force": True}](self.target, check=False)
        try:
            if run.returncode and "no such container" not in run.stderr.lower():
                raise TestFailure(run.stderr.strip() or run.stdout.strip())
            return True
        except (OSError, subprocess.SubprocessError, TestFailure) as error:
            print(
                f"Could not remove owned container {self.target}: {error}",
                file=sys.stderr,
            )
            return False


class Checks:
    def __init__(self) -> None:
        self.passed: int = 0

    def success(self, name: str) -> None:
        self.passed += 1
        print(f"ok {self.passed} - {name}", flush=True)

    def rows(
        self,
        name: str,
        actual: list[list[str]],
        expected: Rows,
    ) -> None:
        if len(actual) != len(expected):
            raise TestFailure(
                f"{name}: expected {len(expected)} rows, got {len(actual)}"
            )
        for row_number, (got, want) in enumerate(zip(actual, expected), start=1):
            if len(got) != len(want):
                raise TestFailure(
                    f"{name}: row {row_number}: expected {want!r}, got {got!r}"
                )
            for value, target in zip(got, want):
                if isinstance(target, float):
                    try:
                        matches = math.isclose(
                            float(value), target, rel_tol=1e-12, abs_tol=1e-12
                        )
                    except ValueError:
                        matches = False
                else:
                    matches = value == (NULL if target is None else target)
                if not matches:
                    raise TestFailure(
                        f"{name}: row {row_number}: expected {want!r}, got {got!r}"
                    )
        self.success(name)


def execute_queries(
    db: Postgres, statements: dict[str, str], *, create_views: bool
) -> tuple[dict[str, list[list[str]]], date]:
    answers: dict[str, list[list[str]]] = {}
    observed_date: date | None = None
    for label, sql in statements.items():
        if label in VIEWS:
            if create_views:
                db.script(sql + ";")
            continue  # On later fixtures the original views deliberately remain in place.
        try:
            if label == "q8":
                # Both CURRENT_DATE readings use the same transaction, even across midnight.
                rows = db.sql("BEGIN;\n" + sql + ";\nSELECT CURRENT_DATE;\nCOMMIT;")
                observed_date = date.fromisoformat(rows[-1][0])
                answers[label] = rows[:-1]
            else:
                answers[label] = db.sql(sql + ";")
        except (TestFailure, ValueError, IndexError) as error:
            raise TestFailure(f"{label}: {error}") from error
    if observed_date is None:
        raise TestFailure("q8 was not executed, so the database date is unknown")
    return answers, observed_date


def daily_rows(counts: dict[date, int]) -> list[list[str]]:
    start = date(2021, 1, 1)
    return [
        [str(day := start + timedelta(days=offset)), str(counts.get(day, 0))]
        for offset in range(365)
    ]


def run_checks(
    db: Postgres, checks: Checks, statements: dict[str, str], sample: str
) -> None:
    db.script((HERE / "schema.sql").read_text(encoding="utf-8"))
    db.script(sample)
    events = db.sql(
        "SELECT doorid, username, event FROM doorlog ORDER BY tim, eventid;"
    )
    checks.rows(
        "sample has 52 events and ten users",
        [[str(len(events)), str(len({row[1] for row in events}))]],
        [["52", "10"]],
    )
    last: dict[tuple[str, int], str] = {}
    for door, username, event in events:
        zone = 0 if door in {"1", "3"} else int(door)
        key = (username, zone)
        if event != ("X" if last.get(key) == "E" else "E"):
            raise TestFailure(f"sample events do not alternate E/X for {key!r}")
        last[key] = event
    checks.success("sample events alternate E/X in every user/zone")

    sample_answers, today = execute_queries(db, statements, create_views=True)
    floor_days = {
        date(2021, 1, 1): 2,
        **{date(2021, 1, day): 1 for day in (3, 4, 5, 6, 7, 8, 9)},
    }
    cases: list[tuple[str, list[list[str]], Rows]] = [
        ("sample q1: front-door entrants", sample_answers["q1"], [["8"]]),
        ("sample q2: latest bathroom state", sample_answers["q2"], [["1"]]),
        (
            "sample presence: Judy's two open stays",
            db.sql(
                'SELECT username, zone FROM presence WHERE "exit" IS NULL ORDER BY username, zone;'
            ),
            [["judy", "0"], ["judy", "2"]],
        ),
        ("sample q2b: open bathroom stays", sample_answers["q2b"], [["1"]]),
        ("sample q3: open building stays", sample_answers["q3"], [["1"]]),
        ("sample q4: inclusive fireworks endpoints", sample_answers["q4"], [["3"]]),
        (
            "sample q5: all 365 dates, carryovers and midnight exit",
            sample_answers["q5"],
            daily_rows(floor_days),
        ),
        (
            "sample q6: daily mean and sample deviation",
            sample_answers["q6"],
            [[9 / 365, math.sqrt((11 - 81 / 365) / 364)]],
        ),
        ("sample q7: floor-42 employees", sample_answers["q7"], [[50.0]]),
        (
            "sample q8: seven visits over the database calendar window",
            sample_answers["q8"],
            [[7 / ((today - date(2021, 1, 1)).days + 1)]],
        ),
        ("sample q9: qualifying same-day arrivals", sample_answers["q9"], [[50.0]]),
        ("sample q10: early departure", sample_answers["q10"], [["bob"]]),
    ]
    for name, actual, expected in cases:
        checks.rows(name, actual, expected)

    db.script("TRUNCATE doorlog;")
    empty_answers, _ = execute_queries(db, statements, create_views=False)
    empty_cases: list[tuple[str, Rows]] = [
        ("q1", [["0"]]),
        ("q2", [["0"]]),
        ("q2b", [["0"]]),
        ("q3", [["0"]]),
        ("q4", [["0"]]),
        ("q5", daily_rows({})),
        ("q6", [[0.0, 0.0]]),
        ("q7", [[None]]),
        ("q8", [[None]]),
        ("q9", [[None]]),
        ("q10", []),
    ]
    for label, expected in empty_cases:
        checks.rows(f"empty {label}", empty_answers[label], expected)
    for view in ("presence", "occupancy"):
        checks.rows(
            f"empty {view}: original view remains usable",
            db.sql(f"SELECT COUNT(*) FROM {view};"),
            [["0"]],
        )

    # Four calendar days: the first has only a building event; days one and three
    # have no bathroom visits. The other two days have two and four visits.
    fixture_answers = db.sql(
        """
        BEGIN;
        INSERT INTO doorlog VALUES (1, 1, CURRENT_DATE - INTERVAL '3 days', 'observer', 'E');
        INSERT INTO doorlog
        SELECT n + 2, 2,
               CURRENT_DATE - (CASE WHEN n < 2 THEN 2 ELSE 0 END) * INTERVAL '1 day'
                            + n * INTERVAL '1 hour',
               'visitor-' || n, 'E'
        FROM generate_series(0, 5) AS n;
    """
        + statements["q8"]
        + ";\nDELETE FROM doorlog WHERE doorid = 2;\n"
        + statements["q8"]
        + ";\nCOMMIT;"
    )
    checks.rows(
        "q8: six visits across four days including two zero-use days",
        fixture_answers[:1],
        [[1.5]],
    )
    checks.rows(
        "q8: observed window without bathroom visits", fixture_answers[1:], [[0.0]]
    )

    db.script("""
        TRUNCATE doorlog;
        INSERT INTO doorlog VALUES
            (1, 1, '2022-07-03 09:00', 'alice', 'E'),
            (2, 1, '2022-07-03 18:00', 'alice', 'X'),
            (3, 1, '2022-07-03 09:00', 'bob', 'E'),
            (4, 1, '2022-07-03 12:00', 'bob', 'X'),
            (5, 1, '2022-07-02 23:00', 'carol', 'E'),
            (6, 1, '2022-07-03 01:00', 'carol', 'X'),
            (7, 1, '2022-07-03 18:00', 'carol', 'E'),
            (8, 1, '2022-07-03 20:00', 'carol', 'X');
    """)
    checks.rows(
        "q9: carryover plus late re-entry does not qualify",
        db.sql(statements["q9"] + ";"),
        [[50.0]],
    )
    db.script("UPDATE doorlog SET tim = '2022-07-03 09:30' WHERE eventid = 7;")
    checks.rows(
        "q9: actual early re-entry qualifies despite carryover",
        db.sql(statements["q9"] + ";"),
        [[100 * 2 / 3]],
    )


class Arguments(argparse.Namespace):
    image: str = "postgres:16"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument(
        "--image",
        default="postgres:16",
        help="PostgreSQL Docker image (default: postgres:16)",
    )
    args = parser.parse_args(namespace=Arguments())
    db, checks, status = Postgres(args.image), Checks(), 0
    try:
        sample = render_sample_data()
        if (HERE / "sample_data.sql").read_bytes() != sample.encode("utf-8"):
            raise TestFailure(
                "sample_data.sql is stale; run python3 generate_sample_data.py before testing"
            )
        checks.success("committed sample matches the generator")
        statements = load_statements()
        checks.success("doors.sql has the reviewed 13-statement layout")
        db.start()
        run_checks(db, checks, statements, sample)
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        status = 130
    except (TestFailure, OSError, subprocess.SubprocessError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        status = 1
    finally:
        if status:
            db.logs()
        if not db.close():
            status = 1
    if status == 0:
        print(f"Passed {checks.passed} checks.")
    return status


if __name__ == "__main__":
    sys.exit(main())
