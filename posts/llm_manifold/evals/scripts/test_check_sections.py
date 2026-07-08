#!/usr/bin/env python3
"""Tests for check_sections.py's REQUIRED-list contract (plan.md Step 0).

Run: python3 test_check_sections.py
"""
import subprocess
import sys
import unittest

from paper_test_helpers import CHECK_SECTIONS, PAPER, HERE


class CheckSectionsTest(unittest.TestCase):
    def test_flags_new_headings_not_yet_written(self):
        # Sections not due until later plan steps (3 and 5) stay missing
        # regardless of how many earlier steps have already landed — a
        # regression check for the REQUIRED-list swap that doesn't go stale
        # every time a later step fills in more prose.
        proc = subprocess.run(
            [sys.executable, str(CHECK_SECTIONS), str(PAPER)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 1, proc.stdout)
        self.assertIn(
            "missing section: 'Prior Art and Novelty Boundaries'", proc.stdout
        )
        self.assertIn(
            "missing section: 'Conclusion'",
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
