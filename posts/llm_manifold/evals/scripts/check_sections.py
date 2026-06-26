#!/usr/bin/env python3
"""Check that paper.md contains every required section heading, non-empty.

Usage: check_sections.py [paper.md]   (default: ../paper.md relative to this file)
Exit 0 = all present and non-empty; exit 1 = something missing/empty (prints why).
The required list is the outline contract from the project design doc.
"""
import re
import sys
from pathlib import Path

REQUIRED = [
    "Introduction",
    "Functions, Programs, and Documents",
    "Generation as a Wander on the Document Manifold",
    "The Agentic-Workflow Lens",
    "Worked Instances",
    "Topology of the Space",
    "Claim Ledger",
    "Caveats and Scope",
    "References",
]


def main() -> int:
    default = Path(__file__).resolve().parents[1] / "paper.md"
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else default
    text = path.read_text(encoding="utf-8")

    # Split into (heading, body) sections on ATX `##` headings.
    parts = re.split(r"^##\s+.*$", text, flags=re.MULTILINE)
    headings = re.findall(r"^##\s+(.*)$", text, flags=re.MULTILINE)
    bodies = parts[1:]  # text before the first heading is the preamble

    failures = []
    for req in REQUIRED:
        idx = next((i for i, h in enumerate(headings) if req.lower() in h.lower()), None)
        if idx is None:
            failures.append(f"missing section: {req!r}")
            continue
        body = bodies[idx].strip() if idx < len(bodies) else ""
        # Treat a TODO-only / placeholder body as empty.
        stripped = re.sub(r"(?im)^\s*(todo|tbd).*$", "", body).strip()
        if not stripped:
            failures.append(f"empty/placeholder section: {req!r}")

    if failures:
        print("\n".join(failures))
        return 1
    print(f"OK: all {len(REQUIRED)} required sections present and non-empty")
    return 0


if __name__ == "__main__":
    sys.exit(main())
