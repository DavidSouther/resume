#!/usr/bin/env python3
"""Tests for Step 3 of the manifold-paper plan: Sections 2-3

(Prior Art and Novelty Boundaries, The Document-Space Model).

Run: python3 test_prior_art_and_document_space.py
"""
import re
import subprocess
import sys
import unittest

from paper_test_helpers import CHECK_CITATIONS, CHECK_SECTIONS, PAPER, REFS, section

NEW_CITATION_KEYS = [
    "amari1998",
    "gulwani2017",
    "strobl2024",
    "milner1977",
    "schulte2014",
    "robinson2025",
]

CAVEATS = [
    "contextual hidden states",
    "union of manifolds",
    "basin of attraction",
]


class PriorArtAndDocumentSpaceStep3Test(unittest.TestCase):
    def test_the_two_new_sections_are_non_empty(self):
        proc = subprocess.run(
            [sys.executable, str(CHECK_SECTIONS), str(PAPER)],
            capture_output=True,
            text=True,
        )
        self.assertNotIn("'Prior Art and Novelty Boundaries'", proc.stdout)
        self.assertNotIn("'The Document-Space Model'", proc.stdout)

    def test_section_2_is_in_the_first_third_of_the_paper(self):
        text = PAPER.read_text(encoding="utf-8")
        headings = [m.start() for m in re.finditer(r"^## ", text, re.MULTILINE)]
        prior_art_start = text.index("## 2. Prior Art and Novelty Boundaries")
        position = headings.index(prior_art_start)
        self.assertLessEqual(
            position, len(headings) // 3 + 1,
            "Prior Art and Novelty Boundaries is not in the first third of the paper",
        )

    def test_section_2_actively_engages_bradley_not_just_cites(self):
        text = PAPER.read_text(encoding="utf-8")
        body = section(text, 2)
        self.assertIn("[@bradley2021]", body)
        self.assertIn("[@bradley2025]", body)
        # "Actively engages" per design.md: states what Bradley et al. already
        # formalize AND where this paper's reading begins -- not a one-liner.
        self.assertIn("enriched category", body.lower())
        self.assertGreater(len(body), 2000, "Section 2 reads like a citation-only stub")

    def test_section_2_has_the_already_formalized_vs_added_table(self):
        text = PAPER.read_text(encoding="utf-8")
        body = section(text, 2)
        self.assertIn("Already formalized by", body)
        self.assertIn("What this paper adds", body)
        self.assertIn("bradley2021", body)

    def test_section_3_carries_the_hard_caveats(self):
        text = PAPER.read_text(encoding="utf-8")
        body = " ".join(section(text, 3).split())
        for caveat in CAVEATS:
            self.assertIn(caveat, body.lower(), f"Section 3 is missing the {caveat!r} caveat")

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
