#!/usr/bin/env python3
"""Generate the deterministic door-log fixture using only the Python standard library."""

import argparse
from pathlib import Path

HERE = Path(__file__).resolve().parent


def render_sample_data() -> str:
    events: list[tuple[str, int, str, str]] = []

    def stay(
        username: str,
        door: int,
        entry: str,
        exit: str | None,
        exit_door: int | None = None,
    ) -> None:
        events.append((entry, door, username, "E"))
        if exit is not None:
            events.append((exit, exit_door or door, username, "X"))

    # Repeated floor visits still count as one daily occupant; bathroom visits count separately.
    stay("alice", 1, "2021-01-01 08:00", "2021-01-01 17:00", 3)
    stay("alice", 2, "2021-01-01 08:30", "2021-01-01 08:35")
    stay("alice", 7, "2021-01-01 09:00", "2021-01-01 10:00")
    stay("alice", 7, "2021-01-01 11:00", "2021-01-01 12:00")
    stay("alice", 2, "2021-01-01 13:00", "2021-01-01 13:05")
    stay("erin", 3, "2021-01-01 09:00", "2021-01-01 12:00", 1)
    stay("erin", 7, "2021-01-01 10:00", "2021-01-01 10:30")
    stay("erin", 2, "2021-01-01 11:00", "2021-01-01 11:05")

    # Ordinary overnight, an entire event-free intervening day, and a midnight exit.
    stay("bob", 3, "2021-01-03 20:00", "2021-01-04 02:00", 1)
    stay("bob", 2, "2021-01-03 20:30", "2021-01-03 20:35")
    stay("bob", 7, "2021-01-03 21:00", "2021-01-04 01:00")
    stay("carol", 1, "2021-01-05 20:00", "2021-01-07 02:00", 3)
    stay("carol", 7, "2021-01-05 21:00", "2021-01-07 01:00")
    stay("dave", 3, "2021-01-08 20:00", "2021-01-09 01:00", 1)
    stay("dave", 7, "2021-01-08 21:00", "2021-01-09 00:00")

    # Two qualifying arrivals (one stays late); later arrivals are outside Q9's cohort.
    stay("alice", 1, "2022-07-03 09:00", "2022-07-03 18:00", 3)
    stay("alice", 2, "2022-07-03 10:00", "2022-07-03 10:05")
    stay("bob", 1, "2022-07-03 09:00", "2022-07-03 12:00")
    stay("dave", 1, "2022-07-03 18:00", "2022-07-03 20:00", 3)
    stay("erin", 1, "2022-07-03 18:30", "2022-07-03 20:30", 3)

    # Q4's inclusive endpoints and an employee who only enters through the back door.
    stay("frank", 1, "2024-07-04 21:00", "2024-07-04 22:00", 3)
    stay("grace", 3, "2024-07-04 21:30", "2024-07-04 22:30", 1)
    stay("heidi", 1, "2024-07-04 22:00", "2024-07-04 23:00", 3)
    stay("ivan", 3, "2024-07-04 10:00", "2024-07-04 11:00")

    # Latest recorded state: Judy re-enters the bathroom and has not left the building.
    stay("judy", 1, "2024-07-05 08:00", None)
    stay("judy", 2, "2024-07-05 09:00", "2024-07-05 09:05")
    stay("judy", 2, "2024-07-05 10:00", None)

    rows = []
    for eventid, (tim, doorid, username, event) in enumerate(
        sorted(events, key=lambda event: event[0]), start=1
    ):
        rows.append(f"({eventid}, {doorid}, '{tim}', '{username}', '{event}')")
    return (
        "-- Reproduce with: python3 generate_sample_data.py\n"
        "INSERT INTO doorlog (eventid, doorid, tim, username, event) VALUES\n"
        + ",\n".join(rows)
        + ";\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=HERE / "sample_data.sql")
    args = parser.parse_args()
    args.output.write_text(render_sample_data(), encoding="utf-8")
    print(f"Generated {args.output}")


if __name__ == "__main__":
    main()
