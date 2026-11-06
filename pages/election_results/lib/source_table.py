"""The one table of sources that every data file cites by `source_id`.

A source is a name (a dataset file, a Wikipedia page and revision, or a Ballotpedia page), the url it came from, and the date or time it was
fetched or checked, which is empty when unknown. Ids are small integers that are never reused for a different source, so the hand maintained files that cite them stay valid
when a pull adds sources.
"""

import csv
import re
from dataclasses import dataclass, fields
from pathlib import Path
from typing import Any

from .model import SourceFormatError

COLUMNS = ("source_id", "name", "url", "fetched_at")
AP_URL = "https://interactives.apelections.org/election-results/data-live/2026-11-03/results/national/"


@dataclass(frozen=True)
class Source:
    source_id: int
    name: str
    url: str
    fetched_at: str


def url_of(name: str) -> str:
    """The url a source name points to, or empty when the name does not say."""
    if name.startswith("https://"):
        return name
    if m := re.search(r"\(revid (\d+)\)(, infobox)?$", name):
        return f"https://en.wikipedia.org/w/index.php?oldid={m.group(1)}"
    if m := re.search(r"doi:(\S+)", name):
        return f"https://doi.org/{m.group(1)}"
    if name.startswith("UF Election Lab"):
        return "https://election.lab.ufl.edu/"
    return AP_URL if name == "ap" else ""


class SourceTable:
    """Sources by id. Looking one up or registering one marks it used, and `write` keeps only the used ones."""

    def __init__(self, sources: list[Source] | None = None) -> None:
        self._by_id: dict[int, Source] = {s.source_id: s for s in sources or []}
        self._by_value: dict[tuple[str, str], int] = {(s.name, s.fetched_at): s.source_id for s in sources or []}
        self._used: set[int] = set()

    @classmethod
    def load(cls, path: Path) -> "SourceTable":
        """An absent file is an empty table. A missing column, a repeated id, or an unreadable id raises SourceFormatError."""
        if not path.exists():
            return cls()
        with path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            missing = [c for c in COLUMNS if c not in (reader.fieldnames or [])]
            if missing:
                raise SourceFormatError(path.name, f"missing column {', '.join(repr(c) for c in missing)}")
            sources: list[Source] = []
            seen: set[int] = set()
            for number, row in enumerate(reader, start=2):
                try:
                    source_id = int(row["source_id"])
                except ValueError as e:
                    raise SourceFormatError(path.name, f"line {number}: {e}") from e
                if source_id in seen:
                    raise SourceFormatError(path.name, f"line {number}: source_id {source_id} repeats")
                seen.add(source_id)
                sources.append(Source(source_id, row["name"].strip(), row["url"].strip(), row["fetched_at"].strip()))
        return cls(sources)

    def get(self, source_id: str | int, where: str = "") -> Source:
        """The source with this id. An empty or unknown id raises SourceFormatError naming `where` (a file and line)."""
        try:
            found = self._by_id[int(source_id)]
        except (KeyError, ValueError):
            raise SourceFormatError(where or "sources.csv", f"source_id {source_id!r} is not in sources.csv") from None
        self._used.add(found.source_id)
        return found

    def id_for(self, name: str, fetched_at: str = "") -> int:
        """The id of this source name and fetch time (or of the name's recorded row when `fetched_at` is empty), added with the next unused id (and the url its name implies) when the table lacks it."""
        key = (name, fetched_at)
        if not fetched_at and key not in self._by_value:  # no fetch time known now, so the name's recorded row stands
            key = next((k for k in self._by_value if k[0] == name), key)
        if key not in self._by_value:
            source_id = max(self._by_id, default=0) + 1
            self._by_id[source_id] = Source(source_id, name, url_of(name), fetched_at)
            self._by_value[key] = source_id
        self._used.add(self._by_value[key])
        return self._by_value[key]

    def write(self, path: Path) -> None:
        """Writes the used sources in id order, through a temporary name so a failure leaves the old file."""
        partial = path.with_name(f".{path.name}.partial")
        try:
            with partial.open("w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f, lineterminator="\n")
                writer.writerow(COLUMNS)
                for source_id in sorted(self._used):
                    s = self._by_id[source_id]
                    writer.writerow([s.source_id, s.name, s.url, s.fetched_at])
        except BaseException:
            partial.unlink(missing_ok=True)
            raise
        partial.replace(path)


def with_source_id(rows: list[Any], table: SourceTable) -> list[dict[str, Any]]:
    """Dataclass rows as CSV dicts: `source` and `fetched_at` become one `source_id` where `source` was, and `unofficial` becomes `official`."""
    out: list[dict[str, Any]] = []
    for row in rows:
        values: dict[str, Any] = {}
        for f in fields(row):
            if f.name == "fetched_at":
                continue
            if f.name == "unofficial":
                values["official"] = not row.unofficial
            elif f.name == "source":
                values["source_id"] = table.id_for(row.source, getattr(row, "fetched_at", ""))
            else:
                values[f.name] = getattr(row, f.name)
        out.append(values)
    return out


def join_sources(rows: list[dict[str, str]], table: SourceTable) -> list[dict[str, str]]:
    """Rows read from a CSV with `source_id`, each with the source `name` as `source`, and its `url` and `fetched_at`, added."""
    joined: list[dict[str, str]] = []
    for number, row in enumerate(rows, start=2):
        s = table.get(row["source_id"], f"line {number}")
        joined.append({**row, "source": s.name, "url": s.url, "fetched_at": s.fetched_at})
    return joined
