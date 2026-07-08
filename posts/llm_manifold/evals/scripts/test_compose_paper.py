#!/usr/bin/env python3
"""Tests for compose_paper.py: sections/*.md -> paper.md.

Run: python3 test_compose_paper.py
"""
import subprocess
import sys
import unittest

from paper_test_helpers import CHECK_SECTIONS, HERE, PAPER

COMPOSE = HERE / "compose_paper.py"
SECTIONS = PAPER.parent / "sections"

EXPECTED_SECTION_FILES = [
    "01_abstract.md",
    "02_intro.md",
    "03_prior_art_document_space.md",
    "04_steering_operators_worked_analysis.md",
    "05_predicts_alternatives.md",
    "06_evaluation_claim_ledger.md",
    "07_conclusion.md",
    "08_references.md",
]


class ComposePaperTest(unittest.TestCase):
    def test_all_expected_section_files_exist(self):
        actual = sorted(p.name for p in SECTIONS.glob("*.md"))
        self.assertEqual(actual, EXPECTED_SECTION_FILES)

    def test_compose_is_idempotent(self):
        subprocess.run([sys.executable, str(COMPOSE)], check=True, capture_output=True)
        first = PAPER.read_text(encoding="utf-8")
        subprocess.run([sys.executable, str(COMPOSE)], check=True, capture_output=True)
        second = PAPER.read_text(encoding="utf-8")
        self.assertEqual(first, second)

    def test_composed_paper_starts_with_front_matter_then_generated_notice(self):
        subprocess.run([sys.executable, str(COMPOSE)], check=True, capture_output=True)
        text = PAPER.read_text(encoding="utf-8")
        self.assertTrue(text.startswith("---\n"), "paper.md must start with YAML front matter")
        front_matter, _, rest = text.partition("\n---\n")
        self.assertIn("GENERATED FILE", rest[:200])

    def test_composed_paper_passes_check_sections(self):
        subprocess.run([sys.executable, str(COMPOSE)], check=True, capture_output=True)
        proc = subprocess.run(
            [sys.executable, str(CHECK_SECTIONS), str(PAPER)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stdout)


if __name__ == "__main__":
    unittest.main()
