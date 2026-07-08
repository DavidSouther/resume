#!/usr/bin/env python3
"""Compose paper.md from the numbered section files under sections/.

Usage: compose_paper.py

sections/*.md is the source of truth for the paper's prose; paper.md is a
generated build artifact that check_sections.py, check_citations.py,
check_pandoc.py, and pandoc itself all read directly. Re-run this script
after editing any file under sections/ -- it is not run automatically.
"""
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
LLM_MANIFOLD = HERE.parents[1]
SECTIONS = LLM_MANIFOLD / "sections"
PAPER = LLM_MANIFOLD / "paper.md"

GENERATED_NOTICE = """<!--
GENERATED FILE -- do not edit directly.
Source sections live in sections/*.md; edit those, then re-run
evals/scripts/compose_paper.py to regenerate this file.
-->
"""


def main() -> int:
    files = sorted(SECTIONS.glob("*.md"))
    if not files:
        raise SystemExit(f"no section files found in {SECTIONS}")

    chunks = [f.read_text(encoding="utf-8").strip("\n") for f in files]
    body = "\n\n".join(chunks) + "\n"

    # The generated-file notice must follow the YAML front matter's closing
    # `---`, since pandoc only recognizes a metadata block at the document's
    # literal first line.
    body, count = re.subn(
        r"^(---\n.*?\n---\n)",
        r"\1\n" + GENERATED_NOTICE,
        body,
        count=1,
        flags=re.DOTALL,
    )
    if count == 0:
        raise SystemExit("sections/01_abstract.md must start with a YAML front matter block")

    PAPER.write_text(body, encoding="utf-8")
    print(f"wrote {PAPER} from {len(files)} section files: {', '.join(f.name for f in files)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
