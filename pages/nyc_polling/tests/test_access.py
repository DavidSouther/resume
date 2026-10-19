import csv
import io
import unittest

from shapely import box

from nyc_tracts.disparity_hypotheses.access import analyze_access, distinct_sites
from nyc_tracts.disparity_hypotheses.hypotheses import poverty_regression, run_tests
from nyc_tracts.disparity_hypotheses.measures import MEASURES, OUT_OF_TRACT, PRIMARY
from nyc_tracts.geography.boe import ElectionDistrict
from nyc_tracts.geography.tract_district import overlay_tracts
from nyc_tracts.kernel.domain import Borough, GeoId, Observation, Site, Tract
from nyc_tracts.presentation.scatter import CSV_COLUMNS, build_scatter, csv_rows


def tract(geoid: str, x0: float, x1: float, poverty: float = 10.0) -> Tract:
    return Tract(GeoId(geoid), Borough("Bronx"), poverty, 50000.0, box(x0, 0, x1, 1), ((x0 + x1) / 2, 0.5))


def observations() -> list[Observation]:
    # Poverty 2 to 45.5 covers all five classes; every third observation has its assigned site in its tract.
    return [Observation(tract(str(i), 0, 1, poverty=2.0 + 1.5 * i), site_in_tract=i % 3 == 0, miles=0.1 * i) for i in range(30)]


class Battery(unittest.TestCase):
    def test_every_measure_gets_the_same_tests_and_the_primary_is_not_repeated(self) -> None:
        primary, tests = run_tests(observations())

        self.assertEqual((primary.kind, primary.measure), ("gradient", PRIMARY.key))
        self.assertEqual(len(tests), 4 * len(MEASURES) - 1)
        for m in MEASURES:
            self.assertEqual(
                sorted(h.kind for h in tests if h.measure == m.key), sorted(["gradient", "two_group", "within_borough", "income"] if m is not PRIMARY else ["two_group", "within_borough", "income"])
            )

    def test_each_test_counts_the_adverse_outcome_of_its_measure(self) -> None:
        obs = observations()

        primary, tests = run_tests(obs)

        self.assertEqual(sum(g["adverse"] for g in primary.groups or []), sum(1 for o in obs if o.miles > 0.25))
        out = next(h for h in tests if h.kind == "gradient" and h.measure == OUT_OF_TRACT.key)
        self.assertEqual(sum(g["adverse"] for g in out.groups or []), sum(1 for o in obs if not o.site_in_tract))

    def test_only_the_other_tests_are_holm_adjusted(self) -> None:
        primary, tests = run_tests(observations())

        self.assertIsNone(primary.holm_p)
        self.assertTrue(all(h.holm_p is not None and h.holm_p >= h.chi_squared["p"] for h in tests))


class Regression(unittest.TestCase):
    def u_shaped(self) -> list[Observation]:
        # miles = 0.0004 (p - 25)^2 + 0.2 exactly, so a quadratic fits perfectly and a line cannot.
        return [Observation(tract(str(i), 0, 1, poverty=float(p)), False, 0.0004 * (p - 25) ** 2 + 0.2) for i, p in enumerate(range(0, 60, 2))]

    def test_quadratic_recovers_a_u_shape_a_line_misses(self) -> None:
        reg = poverty_regression(self.u_shaped())

        line, quad, _ = reg.fits
        self.assertAlmostEqual(quad.r2, 1.0, places=9)
        self.assertAlmostEqual(quad.vertex or 0.0, 25.0, places=6)
        self.assertLess(line.r2, 0.3)
        self.assertIn(reg.best_by_adj_r2, (2, 3))
        self.assertLess(reg.tests[0]["p"], 1e-10)  # the quadratic term earns its place over the line
        self.assertGreater(reg.tests[1]["p"], 0.05)  # and the cubic term adds nothing

    def test_tract_districts_without_poverty_are_left_out(self) -> None:
        obs = [*self.u_shaped(), Observation(tract("x", 0, 1, poverty=None), False, 9.0)]  # type: ignore[arg-type]

        self.assertEqual(poverty_regression(obs).n, 30)


class Report(unittest.TestCase):
    def test_report_answers_one_question_with_every_measure(self) -> None:
        tracts = [tract(str(i), i, i + 1, poverty=2.0 + 1.5 * i) for i in range(30)]
        districts = [ElectionDistrict(i, box(i, 0, i + 1, 1)) for i in range(30)]
        near, far = Site("near", 0.5, 0.5), Site("far", 100.0, 0.5)
        site_of = {i: near if i % 3 == 0 else far for i in range(30)}

        report = analyze_access(tracts, overlay_tracts(tracts, districts, site_of), distinct_sites(site_of))

        self.assertEqual((report.tract_districts, report.tracts, report.poll_sites, report.poll_sites_outside_tracts), (30, 30, 2, 1))
        self.assertEqual([m.key for m in report.measures], [m.key for m in MEASURES])
        self.assertEqual([c.n for c in report.by_class], [6, 6, 7, 7, 4])
        self.assertEqual(report.regression.n, 30)
        self.assertEqual(report.overall_rates[OUT_OF_TRACT.key], 29 / 30)  # only tract 0 contains its assigned site


class ScatterData(unittest.TestCase):
    def test_file_holds_one_point_per_tract_district_and_a_curve_per_degree(self) -> None:
        tracts = [tract(str(i), i, i + 1, poverty=2.0 + 1.5 * i) for i in range(30)]
        districts = [ElectionDistrict(i, box(i, 0, i + 1, 1)) for i in range(30)]
        site_of = {i: Site("s", 100.0 * (i % 5) / 5, 0.5) for i in range(30)}

        data = build_scatter(overlay_tracts(tracts, districts, site_of).tract_districts)

        self.assertEqual(data["n"], 30)
        self.assertEqual({len(v) for v in data["points"].values()}, {30})
        self.assertEqual([f["degree"] for f in data["fits"]], [1, 2, 3])
        self.assertTrue(all(len(f["x"]) == len(f["y"]) == 101 for f in data["fits"]))

    def test_csv_has_a_header_row_width_and_one_row_per_tract_district(self) -> None:
        tracts = [tract(str(i), i, i + 1, poverty=2.0 + 1.5 * i) for i in range(3)]
        districts = [ElectionDistrict(i, box(i, 0, i + 1, 1)) for i in range(3)]
        site_of = {i: Site("A, B", 0.5, 0.5) for i in range(3)}

        rows = csv_rows(overlay_tracts(tracts, districts, site_of).tract_districts)

        self.assertEqual(len(rows), 3)
        self.assertTrue(all(len(r) == len(CSV_COLUMNS) for r in rows))
        out = io.StringIO()
        csv.writer(out).writerows(rows)
        self.assertEqual(next(csv.reader(io.StringIO(out.getvalue())))[3], "A, B")  # a comma in a site name stays one cell
