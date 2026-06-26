#!/usr/bin/env python3
"""Check that every citation key used in paper.md resolves to a refs.bib entry.

Usage: check_citations.py [paper.md] [refs.bib]
Exit 0 = every cited key is defined and no entry is malformed; exit 1 otherwise.

Recognizes pandoc citations `[@key]` and the claim-ledger's bare `[key]` form.
Each refs.bib entry must carry a year and an arXiv/DOI/url note (IEEE anchors).
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]


def bib_entries(bib_text: str) -> dict[str, str]:
    entries = {}
    for m in re.finditer(r"@\w+\s*\{\s*([^,]+)\s*,(.*?)\n\}", bib_text, flags=re.DOTALL):
        entries[m.group(1).strip()] = m.group(2)
    return entries


def main() -> int:
    paper = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "paper.md"
    bib = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "refs.bib"

    paper_text = paper.read_text(encoding="utf-8")
    entries = bib_entries(bib.read_text(encoding="utf-8"))

    # `[@key]` pandoc cites and `[key]` ledger cites (lowercase+digits, not pure ints).
    cited = set(re.findall(r"\[@([A-Za-z][\w:-]+)\]", paper_text))
    cited |= {
        k for k in re.findall(r"\[([a-z][a-z0-9]+\d{2,4})\]", paper_text)
    }

    failures = []
    for key in sorted(cited):
        if key not in entries:
            failures.append(f"cited but undefined in refs.bib: [{key}]")

    for key, body in entries.items():
        if not re.search(r"year\s*=", body):
            failures.append(f"refs.bib entry missing year: {key}")
        if not re.search(r"(arXiv:|doi|url|howpublished|booktitle|journal)", body, re.I):
            failures.append(f"refs.bib entry missing venue/arXiv/DOI: {key}")

    if not cited:
        failures.append("no citation keys found in paper.md")

    if failures:
        print("\n".join(failures))
        return 1
    print(f"OK: {len(cited)} cited keys all resolve; {len(entries)} entries well-formed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
