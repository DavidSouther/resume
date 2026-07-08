#!/usr/bin/env python3
"""Tests for Step 4 of the manifold-paper plan: Section 8

(Evaluation and Claim Ledger).

Run: python3 test_evaluation_and_ledger.py
"""
import subprocess
import sys
import unittest

from paper_test_helpers import CHECK_SECTIONS, PAPER, section

SIX_FIELD_HEADER = [
    "Claim",
    "Status",
    "Support",
    "Does not support",
    "Section",
    "Risk if wrong",
]

MANDATORY_CLAIM_FRAGMENTS = [
    "steering operators",
    "conditioning",
    "external execution feedback",
    "serial computation depth",
    "intermediate document",
    "branch exploration",
    "low-dimensional structure",
    "union",
    "basin",
    "enriched category",
    "speculative",
]


class EvaluationAndLedgerStep4Test(unittest.TestCase):
    def test_the_new_section_is_non_empty(self):
        proc = subprocess.run(
            [sys.executable, str(CHECK_SECTIONS), str(PAPER)],
            capture_output=True,
            text=True,
        )
        self.assertNotIn("'Evaluation and Claim Ledger'", proc.stdout)

    def test_ledger_uses_the_six_field_header(self):
        text = PAPER.read_text(encoding="utf-8")
        body = section(text, 8)
        for field in SIX_FIELD_HEADER:
            self.assertIn(field, body, f"ledger header is missing {field!r}")

    def test_ledger_covers_all_mandatory_rows(self):
        text = PAPER.read_text(encoding="utf-8")
        body = section(text, 8).lower()
        for fragment in MANDATORY_CLAIM_FRAGMENTS:
            self.assertIn(fragment, body, f"ledger is missing a row about {fragment!r}")

    def test_every_row_has_does_not_support_and_risk_if_wrong_populated(self):
        text = PAPER.read_text(encoding="utf-8")
        body = section(text, 8)
        rows = [
            line
            for line in body.splitlines()
            if line.strip().startswith("|") and "---" not in line
        ]
        # Drop the header row itself.
        data_rows = [r for r in rows if "Does not support" not in r]
        self.assertGreaterEqual(len(data_rows), 11, "expected at least 11 ledger rows")
        for row in data_rows:
            cells = [c.strip() for c in row.strip().strip("|").split("|")]
            self.assertEqual(len(cells), 6, f"row does not have 6 cells: {row!r}")
            does_not_support, risk_if_wrong = cells[3], cells[5]
            self.assertTrue(does_not_support, f"empty 'Does not support' in row: {row!r}")
            self.assertTrue(risk_if_wrong, f"empty 'Risk if wrong' in row: {row!r}")

    def test_readiness_gate_summarizes_both_halves(self):
        text = PAPER.read_text(encoding="utf-8")
        body = section(text, 8)
        self.assertIn("Lit Group", body)
        self.assertIn("transfer test", body.lower())
        self.assertIn("check_sections.py", body)


if __name__ == "__main__":
    unittest.main()
