#!/usr/bin/env python3
"""Tests for check_sections.py against the Step-0 contribution-first outline contract.

Run: python3 test_check_sections.py
"""
import subprocess
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / "check_sections.py"
PAPER = HERE.parents[1] / "paper.md"  # posts/llm_manifold/paper.md


class CheckSectionsTest(unittest.TestCase):
    def test_rejects_the_old_geometry_first_skeleton(self):
        proc = subprocess.run(
            [sys.executable, str(SCRIPT), str(PAPER)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 1, proc.stdout)
        self.assertIn(
            "missing section: 'Prior Art and Novelty Boundaries'", proc.stdout
        )
        self.assertIn(
            "missing section: 'Steering Operators for Agentic Workflows'",
            proc.stdout,
        )

    def test_required_titles_have_no_substring_collisions(self):
        sys.path.insert(0, str(HERE))
        import check_sections

        titles = check_sections.REQUIRED
        for i, a in enumerate(titles):
            for j, b in enumerate(titles):
                if i == j:
                    continue
                self.assertNotIn(
                    a.lower(),
                    b.lower(),
                    f"{a!r} is a substring of {b!r}; check_sections.py's substring "
                    "matcher would false-match",
                )


if __name__ == "__main__":
    unittest.main()
