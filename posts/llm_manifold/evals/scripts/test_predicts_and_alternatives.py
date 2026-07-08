#!/usr/bin/env python3
"""Tests for Step 2 of the manifold-paper plan: Sections 6-7

(What This Lens Predicts, Alternative Views and Limitations).

Run: python3 test_predicts_and_alternatives.py
"""
import re
import subprocess
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
CHECK_SECTIONS = HERE / "check_sections.py"
PAPER = HERE.parents[1] / "paper.md"

SEVEN_CONDITIONS = [
    "observability",
    "feedback reliability",
    "search breadth",
    "inspectability",
    "serial dependency",
    "cost",
    "shared prompt",
]

ALTERNATIVE_VIEWS = [
    "Program synthesis",
    "MDP",
    "Information geometry",
    "Category theory",
    "Just prompt engineering",
]


class PredictsAndAlternativesStep2Test(unittest.TestCase):
    def test_the_two_new_sections_are_non_empty(self):
        proc = subprocess.run(
            [sys.executable, str(CHECK_SECTIONS), str(PAPER)],
            capture_output=True,
            text=True,
        )
        self.assertNotIn("'What This Lens Predicts'", proc.stdout)
        self.assertNotIn("'Alternative Views and Limitations'", proc.stdout)

    def test_predictive_section_names_all_seven_conditions(self):
        text = PAPER.read_text(encoding="utf-8")
        section = re.search(
            r"^## 6\..*?(?=^## 7\.)", text, re.MULTILINE | re.DOTALL
        ).group(0)
        for condition in SEVEN_CONDITIONS:
            self.assertIn(
                condition.lower(),
                section.lower(),
                f"Section 6 is missing the {condition!r} condition",
            )

    def test_predictive_section_states_reversal_not_restatement(self):
        # Guards against the symposium's "relabeling prompt engineering"
        # objection: the section must claim operators can flip from helpful
        # to harmful/useless under stated conditions, not just list them.
        text = PAPER.read_text(encoding="utf-8")
        section = re.search(
            r"^## 6\..*?(?=^## 7\.)", text, re.MULTILINE | re.DOTALL
        ).group(0)
        self.assertIn("reverse", section.lower())

    def test_alternative_views_section_covers_all_five_views(self):
        text = PAPER.read_text(encoding="utf-8")
        section = re.search(
            r"^## 7\..*?(?=^## 8\.)", text, re.MULTILINE | re.DOTALL
        ).group(0)
        for view in ALTERNATIVE_VIEWS:
            self.assertIn(view, section, f"Section 7 is missing {view!r}")

    def test_alternative_views_section_states_venue_fit_limitation(self):
        text = PAPER.read_text(encoding="utf-8")
        section = re.search(
            r"^## 7\..*?(?=^## 8\.)", text, re.MULTILINE | re.DOTALL
        ).group(0)
        self.assertIn("NeurIPS", section)
        self.assertIn("position", section.lower())

    def test_relocated_ledger_is_staged_not_lost(self):
        text = PAPER.read_text(encoding="utf-8")
        section = re.search(r"^## 8\..*", text, re.MULTILINE | re.DOTALL).group(0)
        self.assertIn("Staged for Step 4", section)
        self.assertIn("valeriani2023", section)


if __name__ == "__main__":
    unittest.main()
