#!/usr/bin/env python3
"""Tests for check_citations.py's citation-key extraction (bugfix during Step 4).

Regression coverage for a bug found while writing Step 4: the old regex
`\\[@([A-Za-z][\\w:-]+)\\]` required a `]` immediately after each key, so it
silently missed every non-last key in a multi-citation pandoc bracket like
`[@key1; @key2]` -- valid, idiomatic pandoc syntax used throughout paper.md.

Run: python3 test_check_citations.py
"""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from paper_test_helpers import CHECK_CITATIONS

BIB_FIXTURE = """\
@misc{key1,
  author = {A. One},
  title  = {One},
  year   = {2020},
  note   = {arXiv:0000.00001}
}

@misc{key2,
  author = {B. Two},
  title  = {Two},
  year   = {2021},
  note   = {arXiv:0000.00002}
}
"""


def _write(tmp_dir: Path, name: str, content: str) -> Path:
    path = tmp_dir / name
    path.write_text(content, encoding="utf-8")
    return path


class CheckCitationsMultiKeyTest(unittest.TestCase):
    def test_resolves_every_key_in_a_multi_citation_bracket(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            paper = _write(
                tmp_dir, "paper.md", "Body citing [@key1; @key2] together.\n"
            )
            bib = _write(tmp_dir, "refs.bib", BIB_FIXTURE)

            proc = subprocess.run(
                [sys.executable, str(CHECK_CITATIONS), str(paper), str(bib)],
                capture_output=True,
                text=True,
            )
        self.assertEqual(proc.returncode, 0, proc.stdout)
        self.assertIn("2 cited keys", proc.stdout)

    def test_ignores_at_signs_in_the_yaml_front_matter(self):
        # The author's contact email is metadata, not a citation of @gmail.
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            paper = _write(
                tmp_dir,
                "paper.md",
                "---\nauthor:\n  - email: someone@gmail.com\n---\n\n"
                "Body citing [@key1].\n",
            )
            bib = _write(tmp_dir, "refs.bib", BIB_FIXTURE)

            proc = subprocess.run(
                [sys.executable, str(CHECK_CITATIONS), str(paper), str(bib)],
                capture_output=True,
                text=True,
            )
        self.assertEqual(proc.returncode, 0, proc.stdout)
        self.assertIn("1 cited keys", proc.stdout)

    def test_still_flags_a_genuinely_undefined_key(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            paper = _write(
                tmp_dir, "paper.md", "Body citing [@key1; @not_defined].\n"
            )
            bib = _write(tmp_dir, "refs.bib", BIB_FIXTURE)

            proc = subprocess.run(
                [sys.executable, str(CHECK_CITATIONS), str(paper), str(bib)],
                capture_output=True,
                text=True,
            )
        self.assertEqual(proc.returncode, 1, proc.stdout)
        self.assertIn("not_defined", proc.stdout)


if __name__ == "__main__":
    unittest.main()
