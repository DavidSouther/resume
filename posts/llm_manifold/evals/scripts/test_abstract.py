#!/usr/bin/env python3
"""Tests for Step 6 of the manifold-paper plan: the front-matter abstract.

Run: python3 test_abstract.py
"""
import re
import unittest

from paper_test_helpers import PAPER


def front_matter(text: str) -> str:
    match = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if match is None:
        raise AssertionError("paper.md has no YAML front matter")
    return match.group(1)


class AbstractStep6Test(unittest.TestCase):
    def test_abstract_no_longer_contains_todo(self):
        text = PAPER.read_text(encoding="utf-8")
        fm = front_matter(text)
        self.assertNotIn("TODO", fm)

    def test_abstract_states_thesis_contribution_and_denial(self):
        text = PAPER.read_text(encoding="utf-8")
        fm = front_matter(text).lower()
        self.assertIn("steering", fm)
        self.assertIn("synthesis", fm)
        self.assertIn("position", fm)
        self.assertIn("not a new", fm)

    def test_abstract_is_consistent_with_the_introduction(self):
        # No drift: the abstract's key terms should also appear in the
        # Introduction it's meant to restate.
        text = PAPER.read_text(encoding="utf-8")
        fm = front_matter(text).lower()
        intro = text.split("## 1. Introduction", 1)[1].split("## 2.", 1)[0].lower()
        for term in ["steering", "synthesis", "position"]:
            self.assertIn(term, intro, f"Introduction is missing {term!r} that the abstract restates")

    def test_no_todo_markers_remain_anywhere_in_the_paper(self):
        text = PAPER.read_text(encoding="utf-8")
        self.assertNotIn("TODO", text)


if __name__ == "__main__":
    unittest.main()
