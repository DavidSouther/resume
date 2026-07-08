#!/usr/bin/env python3
"""Tests for check_sections.py's REQUIRED-list contract (plan.md Step 0).

Run: python3 test_check_sections.py
"""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from paper_test_helpers import CHECK_SECTIONS, HERE

# A minimal fixture with none of the 10 required headings, so this test
# stays meaningful regardless of how much of the live paper.md has been
# written by later plan steps -- unlike asserting against paper.md itself,
# which goes stale every time a section gets filled in.
EMPTY_SKELETON = "# Title\n\n## Some Other Heading\n\nbody text.\n"


class CheckSectionsTest(unittest.TestCase):
    def test_flags_every_required_heading_as_missing_on_an_empty_skeleton(self):
        with tempfile.NamedTemporaryFile(
            "w", suffix=".md", delete=False, encoding="utf-8"
        ) as f:
            f.write(EMPTY_SKELETON)
            fixture = Path(f.name)
        try:
            proc = subprocess.run(
                [sys.executable, str(CHECK_SECTIONS), str(fixture)],
                capture_output=True,
                text=True,
            )
        finally:
            fixture.unlink()

        self.assertEqual(proc.returncode, 1, proc.stdout)
        sys.path.insert(0, str(HERE))
        import check_sections

        for required in check_sections.REQUIRED:
            self.assertIn(f"missing section: {required!r}", proc.stdout)

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
