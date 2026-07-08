#!/usr/bin/env python3
"""Tests for Step 2 of the manifold-paper plan: Sections 6-7

(What This Lens Predicts, Alternative Views and Limitations).

Run: python3 test_predicts_and_alternatives.py
"""
import subprocess
import sys
import unittest

from paper_test_helpers import CHECK_SECTIONS, PAPER, section

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
        body = section(text, 6)
        for condition in SEVEN_CONDITIONS:
            self.assertIn(
                condition.lower(),
                body.lower(),
                f"Section 6 is missing the {condition!r} condition",
            )

    def test_predictive_section_states_reversal_not_restatement(self):
        # Guards against the symposium's "relabeling prompt engineering"
        # objection: the section must claim operators can flip from helpful
        # to harmful/useless under stated conditions, not just list them.
        text = PAPER.read_text(encoding="utf-8")
        body = section(text, 6)
        self.assertIn("reverse", body.lower())

    def test_alternative_views_section_covers_all_five_views(self):
        text = PAPER.read_text(encoding="utf-8")
        body = section(text, 7)
        for view in ALTERNATIVE_VIEWS:
            self.assertIn(view, body, f"Section 7 is missing {view!r}")

    def test_alternative_views_section_states_venue_fit_limitation(self):
        text = PAPER.read_text(encoding="utf-8")
        body = section(text, 7)
        self.assertIn("NeurIPS", body)
        self.assertIn("position", body.lower())

    def test_old_ledgers_citations_survived_into_the_new_ledger(self):
        # Step 2 relocated the old 4-column ledger into Section 8 staged for
        # Step 4's six-field upgrade; now that Step 4 has run, the "Staged"
        # marker is gone by design -- what must survive is the substance,
        # i.e. every citation the old ledger carried still appears somewhere
        # in the new Section 8.
        text = PAPER.read_text(encoding="utf-8")
        body = section(text, 8)
        for key in ["valeriani2023", "tulchinskii2023", "brown2023", "zekri2024"]:
            self.assertIn(key, body, f"old ledger's {key!r} citation did not survive the Step 4 upgrade")


if __name__ == "__main__":
    unittest.main()
