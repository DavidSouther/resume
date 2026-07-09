#!/usr/bin/env python3
"""Tests for Step 5 of the manifold-paper plan: Sections 1, 9, 10

(Introduction, Conclusion, References) -- the step that brings
check_sections.py to full green across all 10 required headings.

Run: python3 test_intro_conclusion_references.py
"""
import subprocess
import sys
import unittest

from paper_test_helpers import CHECK_CITATIONS, CHECK_PANDOC, CHECK_SECTIONS, PAPER, section

INTRODUCTION_HEDGES = ["as if", "region"]
DENIED_CLAIMS = ["theorem", "categorical formalism", "metric"]
CHECKLIST_FIELDS = [
    "impulse",
    "target region",
    "signal",
    "referent validation",
    "evidence",
]


class IntroConclusionReferencesStep5Test(unittest.TestCase):
    def test_check_sections_is_fully_green(self):
        proc = subprocess.run(
            [sys.executable, str(CHECK_SECTIONS), str(PAPER)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stdout)
        self.assertIn("all 10 required sections", proc.stdout)

    def test_introduction_states_thesis_with_hedges_and_denies_overclaims(self):
        text = PAPER.read_text(encoding="utf-8")
        body = section(text, 1)
        for hedge in INTRODUCTION_HEDGES:
            self.assertIn(hedge, body.lower(), f"Introduction is missing the {hedge!r} hedge")
        for claim in DENIED_CLAIMS:
            self.assertIn(claim, body.lower(), f"Introduction does not deny {claim!r}")
        self.assertIn("position", body.lower())
        self.assertIn("synthesis", body.lower())

    def test_conclusion_gives_the_five_field_checklist(self):
        text = PAPER.read_text(encoding="utf-8")
        body = section(text, 9).lower()
        for field in CHECKLIST_FIELDS:
            self.assertIn(field, body, f"Conclusion checklist is missing {field!r}")

    def test_citations_and_pandoc_build_are_green(self):
        proc = subprocess.run(
            [sys.executable, str(CHECK_CITATIONS), str(PAPER)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stdout)

        proc = subprocess.run(
            [sys.executable, str(CHECK_PANDOC), str(PAPER)],
            capture_output=True,
            text=True,
        )
        # pandoc may not be installed in every environment; that's a
        # pre-existing gap (evals/README.md), not this step's regression.
        if "pandoc not installed" in proc.stdout:
            self.skipTest("pandoc not installed in this environment")
        self.assertEqual(proc.returncode, 0, proc.stdout)


if __name__ == "__main__":
    unittest.main()
