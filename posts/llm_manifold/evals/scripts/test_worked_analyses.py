#!/usr/bin/env python3
"""Tests for Step 1 of the manifold-paper plan: Sections 4-5

(Steering Operators for Agentic Workflows, Worked Analyses).

Run: python3 test_worked_analyses.py
"""
import re
import subprocess
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
CHECK_SECTIONS = HERE / "check_sections.py"
CHECK_CITATIONS = HERE / "check_citations.py"
PAPER = HERE.parents[1] / "paper.md"
REFS = HERE.parents[1] / "refs.bib"

NEW_CITATION_KEYS = [
    "yao2023react",
    "gao2023hyde",
    "vake2025hype",
    "zhou2024lats",
    "wang2023selfconsistency",
    "du2023debate",
    "wang2024moa",
]

OPERATOR_TABLE_ROWS = [
    "Prompting",
    "HyDE",
    "External tool",
    "chain-of-thought",
    "Subagents",
    "ReAct",
    "LATS",
]


class WorkedAnalysesStep1Test(unittest.TestCase):
    def test_the_two_new_sections_are_non_empty(self):
        proc = subprocess.run(
            [sys.executable, str(CHECK_SECTIONS), str(PAPER)],
            capture_output=True,
            text=True,
        )
        self.assertNotIn("Steering Operators for Agentic Workflows", proc.stdout)
        self.assertNotIn("'Worked Analyses'", proc.stdout)

    def test_operator_table_covers_all_seven_operators(self):
        text = PAPER.read_text(encoding="utf-8")
        section = re.search(
            r"^## 4\..*?(?=^## 5\.)", text, re.MULTILINE | re.DOTALL
        ).group(0)
        for row in OPERATOR_TABLE_ROWS:
            self.assertIn(row, section, f"operator table is missing {row!r}")

    def test_worked_analyses_leads_with_react(self):
        text = PAPER.read_text(encoding="utf-8")
        section = re.search(
            r"^## 5\..*?(?=^## 6\.)", text, re.MULTILINE | re.DOTALL
        ).group(0)
        subsections = re.findall(r"^###\s+(.*)$", section, re.MULTILINE)
        self.assertTrue(subsections, "Worked Analyses has no ### subsections")
        self.assertIn("ReAct", subsections[0])

    def test_hand_picked_not_base_rate_caveat_present_verbatim(self):
        # Markdown source hard-wraps prose lines, so normalize whitespace
        # before substring checks rather than requiring one physical line.
        text = " ".join(PAPER.read_text(encoding="utf-8").split())
        self.assertIn("hand-picked", text)
        self.assertIn("not a random sample", text)
        self.assertIn("two-thirds", text)

    def test_new_citation_keys_are_cited_and_resolve(self):
        text = PAPER.read_text(encoding="utf-8")
        for key in NEW_CITATION_KEYS:
            self.assertIn(f"[@{key}", text, f"{key} is defined but never cited")

        proc = subprocess.run(
            [sys.executable, str(CHECK_CITATIONS), str(PAPER), str(REFS)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stdout)


if __name__ == "__main__":
    unittest.main()
