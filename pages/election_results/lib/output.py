"""CSV writing for row dataclasses, with lowercase booleans and empty cells for nulls."""

import csv
from dataclasses import fields, is_dataclass
from pathlib import Path
from typing import cast


def write_csvs(out: Path, **tables: list[object]) -> None:
    """Writes `<out>/<name>.csv` for each table.

    Every table is written to a temporary name first and all are renamed only after each one was written, so a failure leaves no partial CSV.
    A row is a dataclass or a dict, and the header comes from the first row (or from nothing, for an empty table).
    """
    out.mkdir(parents=True, exist_ok=True)
    partials: list[tuple[Path, Path]] = []
    try:
        for name, rows in tables.items():
            final = out / f"{name}.csv"
            partial = out / f".{name}.csv.partial"
            with partial.open("w", newline="") as f:
                writer = csv.writer(f, lineterminator="\n")
                header = _header(rows[0]) if rows else []
                writer.writerow(header)
                for row in rows:
                    values = _values(row)
                    writer.writerow([_cell(values[h]) for h in header])
            partials.append((partial, final))
    except BaseException:
        for partial, _ in partials:
            partial.unlink(missing_ok=True)
        raise
    for partial, final in partials:
        partial.replace(final)


def _header(row: object) -> list[str]:
    if is_dataclass(row):
        return [f.name for f in fields(row)]
    if isinstance(row, dict):
        return [str(k) for k in cast("dict[object, object]", row)]
    raise TypeError(f"cannot write a {type(row).__name__} row")


def _values(row: object) -> dict[str, object]:
    if is_dataclass(row):
        return {f.name: getattr(row, f.name) for f in fields(row)}
    if isinstance(row, dict):
        return {str(k): v for k, v in cast("dict[object, object]", row).items()}
    raise TypeError(f"cannot write a {type(row).__name__} row")


def _cell(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)
