#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["statsmodels>=0.14",  "shapely>=2.0", "jinja2>=3.1", "httpx>=0.27", "tenacity>=8.2"]
# ///
"""Run the unit tests: `uv run run_tests.py`. statsmodels (and scipy) are here only for tests/test_stats_crosscheck.py."""

import sys
import unittest
from pathlib import Path

here = Path(__file__).parent
sys.path.insert(0, str(here))
suite = unittest.defaultTestLoader.discover(str(here / "tests"), top_level_dir=str(here))
sys.exit(not unittest.TextTestRunner(verbosity=1).run(suite).wasSuccessful())
