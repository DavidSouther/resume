import os
import unittest

import nyc_tracts_poll_disparity as d

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "nyc_polling")


class Stats(unittest.TestCase):
    def test_chi2_critical_values(self):
        self.assertAlmostEqual(d.chi2_sf(3.841459, 1), 0.05, places=5)
        self.assertAlmostEqual(d.chi2_sf(9.487729, 4), 0.05, places=5)
        self.assertAlmostEqual(d.chi2_sf(0.0, 3), 1.0)

    def test_two_by_two(self):
        r = d.chi_squared([[10, 20], [30, 40]])
        self.assertAlmostEqual(r["chi2"], 0.7937, places=3)
        self.assertAlmostEqual(r["p"], 0.3730, places=3)

    def test_trend_detects_monotone(self):
        z = d.trend_test([[10, 90], [20, 80], [30, 70], [40, 60]])
        self.assertGreater(z["z"], 3)
        self.assertLess(z["p_one_sided"], 0.001)

    def test_holm(self):
        self.assertEqual(d.holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06])

    def test_point_in_polygon_with_hole(self):
        poly = [[(0, 0), (4, 0), (4, 4), (0, 4)], [(1, 1), (3, 1), (3, 3), (1, 3)]]
        self.assertTrue(d.polygon_contains(poly, 0.5, 0.5))
        self.assertFalse(d.polygon_contains(poly, 2, 2))


@unittest.skipUnless(os.path.exists(os.path.join(DATA, "nyc_poll_sites.kml")), "KML output not generated")
class Feature(unittest.TestCase):
    def test_report_from_generated_kml(self):
        r = d.analyze(DATA)
        self.assertGreater(r["tracts_analyzed"], 2000)
        self.assertEqual(sum(g["tracts"] for g in r["baseline"]["groups"]), r["tracts_analyzed"])
        self.assertEqual(len(r["baseline"]["groups"]), 5)
        self.assertEqual(len(r["related"]), 6)
        self.assertGreater(r["tracts_with_site"], 0)
        self.assertIn("## H0 baseline", d.render_md(r))


if __name__ == "__main__":
    unittest.main()
