"""The plain Python statistics agree with scipy and statsmodels. Skipped when those are not installed."""

# statsmodels and scipy ship loose types, so they are loaded dynamically and typed as Any.
import importlib
import random
import unittest
from typing import Any

from nyc_tracts.generic import stats

sp: Any = None
np: Any = None
StratifiedTable: Any = None
multipletests: Any = None
try:
    sp = importlib.import_module("scipy.stats")
    np = importlib.import_module("numpy")
    StratifiedTable = importlib.import_module("statsmodels.stats.contingency_tables").StratifiedTable
    multipletests = importlib.import_module("statsmodels.stats.multitest").multipletests
except ImportError:  # the analysis scripts do not need them
    sp = None


@unittest.skipIf(sp is None, "scipy and statsmodels not installed")
class CrossCheck(unittest.TestCase):
    def setUp(self) -> None:
        self.rng = random.Random(7)

    def tables(self, rows: int, cols: int, count: int) -> list[list[list[int]]]:
        return [[[self.rng.randint(1, 400) for _ in range(cols)] for _ in range(rows)] for _ in range(count)]

    def test_chi2_sf_and_normal_sf(self) -> None:
        for df in (1, 2, 4, 9, 30):
            for x in (0.01, 0.5, 3.84, 9.49, 25.0, 80.0):
                self.assertAlmostEqual(stats.chi2_sf(x, df), float(sp.chi2.sf(x, df)), delta=1e-12)
        for z in (-4.0, -1.0, 0.0, 0.7, 2.5, 6.0):
            self.assertAlmostEqual(stats.normal_sf(z), float(sp.norm.sf(z)), delta=1e-14)

    def test_chi_squared_matches_scipy_with_and_without_yates(self) -> None:
        for table in [*self.tables(5, 2, 20), *self.tables(2, 2, 20), *self.tables(3, 4, 10)]:
            for correction in (False, True):
                ours = stats.chi_squared(table, correction=correction)
                chi2, p, df, expected = sp.chi2_contingency(np.array(table, dtype=float), correction=correction)
                self.assertAlmostEqual(ours["chi2"], float(chi2), delta=1e-9)
                self.assertAlmostEqual(ours["p"], float(p), delta=1e-12)
                self.assertEqual(ours["df"], int(df))
                self.assertAlmostEqual(ours.get("min_expected", 0.0), float(expected.min()), delta=1e-9)

    def test_mantel_haenszel_matches_statsmodels(self) -> None:
        for _ in range(10):
            strata = self.tables(2, 2, 5)
            ours = stats.mantel_haenszel(strata)
            st = StratifiedTable([np.array(s, dtype=float) for s in strata])
            test = st.test_null_odds(correction=True)
            self.assertAlmostEqual(ours["common_odds_ratio"], float(st.oddsratio_pooled), delta=1e-9)
            self.assertAlmostEqual(ours["chi2"], float(test.statistic), delta=1e-9)
            self.assertAlmostEqual(ours["p"], float(test.pvalue), delta=1e-12)

    def test_holm_matches_statsmodels(self) -> None:
        for _ in range(20):
            pvals = [self.rng.random() ** 3 for _ in range(self.rng.randint(1, 8))]
            expected = [float(p) for p in multipletests(pvals, method="holm")[1]]
            for ours, theirs in zip(stats.holm(pvals), expected, strict=True):
                self.assertAlmostEqual(ours, theirs, delta=1e-12)
