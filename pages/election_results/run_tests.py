#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["duckdb>=1.4", "numpy>=2", "statsmodels>=0.14", "jsonschema>=4.23"]
# ///
"""Run the unit tests: `uv run run_tests.py`. The feature test runs on its own (see tests/test_feature_election_results.py)."""

import sys
import unittest
from pathlib import Path

here = Path(__file__).parent
sys.path.insert(0, str(here))
FEATURE = "test_feature_election_results"
names = [f"tests.{p.stem}" for p in sorted((here / "tests").glob("test_*.py")) if p.stem != FEATURE]
suite = unittest.defaultTestLoader.loadTestsFromNames(names)
sys.exit(not unittest.TextTestRunner(verbosity=1).run(suite).wasSuccessful())
