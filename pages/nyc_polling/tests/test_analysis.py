import unittest

from shapely import Polygon

from nyc_tracts.domain import Borough, GeoId, Site, Tract
from nyc_tracts.hypotheses import disparate_impact, site_tracts
from nyc_tracts.stats import chi_squared, holm, mantel_haenszel, trend_test


def square(geoid: str, x0: float, y0: float, x1: float, y1: float, hole: list[tuple[float, float]] | None = None) -> Tract:
    poly = Polygon([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], [hole] if hole else [])
    return Tract(GeoId(geoid), Borough("Bronx"), 10.0, 50000.0, poly, (0, 0))


class Stats(unittest.TestCase):
    def test_two_by_two(self) -> None:
        table = [[10, 20], [30, 40]]

        r = chi_squared(table)

        self.assertAlmostEqual(r["chi2"], 0.7937, places=3)
        self.assertAlmostEqual(r["p"], 0.3730, places=3)

    def test_trend_detects_monotone(self) -> None:
        table = [[10, 90], [20, 80], [30, 70], [40, 60]]

        z = trend_test(table)

        self.assertGreater(z["z"], 3)
        self.assertLess(z["p_one_sided"], 0.001)

    def test_holm(self) -> None:
        self.assertEqual([round(p, 12) for p in holm([0.01, 0.04, 0.03])], [0.03, 0.06, 0.06])

    def test_mantel_haenszel_identical_strata_keep_odds_ratio(self) -> None:
        strata = [[[10, 20], [30, 40]]] * 3

        r = mantel_haenszel(strata)

        self.assertAlmostEqual(r["common_odds_ratio"], (10 * 40) / (20 * 30))


class EmptyTables(unittest.TestCase):
    def test_chi_squared_rejects_an_empty_row(self) -> None:
        with self.assertRaisesRegex(ValueError, "empty row or column"):
            chi_squared([[3, 4], [0, 0]])

    def test_chi_squared_rejects_an_empty_column(self) -> None:
        with self.assertRaisesRegex(ValueError, "empty row or column"):
            chi_squared([[0, 4], [0, 9]])

    def test_chi_squared_rejects_a_ragged_table(self) -> None:
        with self.assertRaisesRegex(ValueError, "rectangular"):
            chi_squared([[1, 2], [3]])


class Impact(unittest.TestCase):
    def test_four_fifths_rule_fails_when_high_poverty_has_fewer_sites(self) -> None:
        table = [[90, 10], [50, 50]]  # [no site, site] for high poverty, then lower poverty

        r = disparate_impact(table)

        self.assertAlmostEqual(r["impact_ratio"] or 0.0, 0.2)
        self.assertTrue(r["fails_four_fifths"])


class Geometry(unittest.TestCase):
    def test_site_in_hole_belongs_to_no_tract(self) -> None:
        tracts = [square("a", 0, 0, 4, 4, hole=[(1, 1), (3, 1), (3, 3), (1, 3)])]

        found = site_tracts(tracts, [Site("in", 0.5, 0.5), Site("hole", 2, 2)])

        self.assertEqual([t.geoid if t else None for t in found], ["a", None])
