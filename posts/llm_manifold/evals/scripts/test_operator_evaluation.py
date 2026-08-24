#!/usr/bin/env python3
"""Feature test for Section 5's technique-evaluation contract.

Section 5's reader is a harness engineer holding a named technique. The section
earns its place only if it classifies that technique by what it adds
(computation, evidence, or alternatives), shows composition can lose evidence
at a boundary, and can reject a change that is not an operator. These
assertions pin that shape so a later edit cannot quietly revert Section 5 to a
literature defense or to the unused August 6 design-patterns catalog.

Run: python3 test_operator_evaluation.py
"""
import re
import subprocess
import sys
import unittest

from paper_test_helpers import CHECK_CITATIONS, PAPER, REFS, section

MECHANISMS = ["computation", "evidence", "alternatives"]

WORKED_CASES = [
    "Self-critique and revision",
    "Delegation and context isolation",
    "Best-of-N and model judges",
    "Persistent memory",
    "Larger context windows",
]

# Citations Section 5 itself still uses after the rewrite.
SECTION_FIVE_CITATIONS = [
    "chen2023",
    "huang2023",
    "kamoi2024",
    "wang2023selfconsistency",
    "du2023debate",
    "wang2024moa",
]

# Evidence that moved into Section 4 must still resolve somewhere in the paper.
PAPER_CITATIONS = [
    "li2024",
    "merrill2023",
    "pfau2024",
    "gao2023hyde",
    "vake2025hype",
    "yao2023react",
    "zhou2024lats",
]


class OperatorEvaluationTest(unittest.TestCase):
    def setUp(self):
        self.text = PAPER.read_text(encoding="utf-8")
        self.body = section(self.text, 5)
        self.flat = " ".join(self.body.split())

    def test_section_five_is_named_for_evaluating_a_technique(self):
        heading = self.body.splitlines()[0]
        self.assertIn(
            "Evaluating a New Technique",
            heading,
            f"Section 5's heading does not state its job: {heading!r}",
        )

    def test_the_three_mechanisms_are_named(self):
        for mechanism in MECHANISMS:
            self.assertIn(
                mechanism,
                self.flat.lower(),
                f"Section 5 never names the {mechanism!r} mechanism",
            )

    def test_worked_cases_are_present(self):
        headings = re.findall(r"^###\s+(.*)$", self.body, re.MULTILINE)
        for case in WORKED_CASES:
            self.assertIn(case, headings, f"Section 5 is missing {case!r}")

    def test_a_larger_context_window_is_not_an_operator(self):
        self.assertIn(
            "does not itself add a new operator",
            self.flat.lower(),
            "Section 5 shows no case that is not an operator",
        )

    def test_composition_inherits_the_weakest_point(self):
        self.assertIn("weakest", self.flat.lower())

    def test_classification_does_not_claim_to_measure_or_rank(self):
        self.assertIn("does not measure", self.flat.lower())
        self.assertIn("does not rank", self.flat.lower())

    def test_the_preserved_citations_are_still_cited_and_resolve(self):
        for key in SECTION_FIVE_CITATIONS:
            self.assertIn(
                f"@{key}",
                self.body,
                f"{key!r} was dropped from Section 5",
            )
        for key in PAPER_CITATIONS:
            self.assertIn(
                f"@{key}",
                self.text,
                f"{key!r} was dropped from the paper",
            )
        proc = subprocess.run(
            [sys.executable, str(CHECK_CITATIONS), str(PAPER), str(REFS)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stdout)


if __name__ == "__main__":
    unittest.main()
