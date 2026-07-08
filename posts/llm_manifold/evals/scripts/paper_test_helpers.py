#!/usr/bin/env python3
"""Shared paths and helpers for the manifold-paper plan-step test files.

Each `test_*.py` file in this directory exercises one plan step against the
live `paper.md`; this module holds what they'd otherwise each redefine.
"""
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
CHECK_SECTIONS = HERE / "check_sections.py"
CHECK_CITATIONS = HERE / "check_citations.py"
CHECK_PANDOC = HERE / "check_pandoc.py"
PAPER = HERE.parents[1] / "paper.md"
REFS = HERE.parents[1] / "refs.bib"


def section(text: str, heading_number: int) -> str:
    """Return the body of `## <heading_number>. ...` up to the next `## N.` heading.

    Falls back to end-of-document if `heading_number` is the paper's last
    numbered section.
    """
    pattern = rf"^## {heading_number}\..*?(?=^## {heading_number + 1}\.|\Z)"
    match = re.search(pattern, text, re.MULTILINE | re.DOTALL)
    if match is None:
        raise AssertionError(f"no '## {heading_number}.' heading found")
    return match.group(0)
