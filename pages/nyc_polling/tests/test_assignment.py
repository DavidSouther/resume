import unittest

from shapely import box

from nyc_tracts.assignment import ElectionDistrict, subdivide
from nyc_tracts.domain import Borough, GeoId, Observation, Site, Tract
from nyc_tracts.hypotheses import run_hypotheses


def tract(geoid: str, x0: float, x1: float, poverty: float = 10.0) -> Tract:
    return Tract(GeoId(geoid), Borough("Bronx"), poverty, 50000.0, box(x0, 0, x1, 1), ((x0 + x1) / 2, 0.5))


class Subdivision(unittest.TestCase):
    def setUp(self) -> None:
        self.a, self.b = tract("A", 0, 2), tract("B", 2, 4, poverty=30.0)
        self.site_in_a = Site("in A", 1.0, 0.5)
        self.site_in_b = Site("in B", 3.0, 0.5)

    def test_tract_inside_one_district_is_one_subdivision(self) -> None:
        districts = [ElectionDistrict(1, box(0, 0, 2, 1)), ElectionDistrict(2, box(2, 0, 4, 1))]

        divided = subdivide([self.a, self.b], districts, {1: self.site_in_a, 2: self.site_in_a})

        self.assertEqual([(s.tract.geoid, s.elect_dist, s.site_in_tract) for s in divided.subdivisions], [("A", 1, True), ("B", 2, False)])
        self.assertEqual(divided.uncovered, [])

    def test_tract_spanning_districts_splits_and_keeps_its_poverty_rate(self) -> None:
        districts = [ElectionDistrict(1, box(0, 0, 0.5, 1)), ElectionDistrict(2, box(0.5, 0, 4, 1))]

        divided = subdivide([self.b], districts, {1: self.site_in_a, 2: self.site_in_b})

        self.assertEqual(len(divided.subdivisions), 1)  # B (x from 2 to 4) only touches district 2
        spanning = subdivide([self.a], districts, {1: self.site_in_b, 2: self.site_in_a}).subdivisions
        self.assertEqual([(s.elect_dist, s.site_in_tract) for s in spanning], [(1, False), (2, True)])
        self.assertEqual({s.tract.poverty for s in spanning}, {10.0})
        self.assertAlmostEqual(sum(s.geometry.area for s in spanning), 2.0)

    def test_tract_with_no_district_is_reported_uncovered(self) -> None:
        divided = subdivide([self.a], [ElectionDistrict(2, box(10, 0, 11, 1))], {2: self.site_in_b})

        self.assertEqual(divided.subdivisions, [])
        self.assertEqual(divided.uncovered, [self.a])

    def test_boundary_slivers_are_dropped(self) -> None:
        sliver = ElectionDistrict(2, box(1.9999999, 0, 2.5, 1))  # overlaps tract A by a hair along the shared edge
        districts = [ElectionDistrict(1, box(0, 0, 1.9999999, 1)), sliver]

        divided = subdivide([self.a], districts, {1: self.site_in_a, 2: self.site_in_b})

        self.assertEqual([s.elect_dist for s in divided.subdivisions], [1])
        self.assertEqual(divided.slivers_dropped, 1)

    def test_distance_is_from_the_subdivision_centroid(self) -> None:
        far = Site("far", 5.0, 0.5)

        divided = subdivide([self.a], [ElectionDistrict(1, box(0, 0, 1, 1))], {1: far})

        self.assertAlmostEqual(divided.subdivisions[0].miles, far.miles_to(0.5, 0.5), places=6)


class Outcome(unittest.TestCase):
    def test_baseline_counts_the_outcome_it_is_given(self) -> None:
        # Poverty 2 to 45.5 covers all five classes; every third observation has a site in its tract.
        obs = [Observation(tract(str(i), 0, 1, poverty=2.0 + 1.5 * i), has_site=i % 3 == 0, nearest_mi=0.1 * i) for i in range(30)]

        default, _ = run_hypotheses(obs)  # default outcome: no site inside the tract
        far, related = run_hypotheses(obs, lambda o: o.nearest_mi > 0.25, (("H3", 0.5),), out_of_tract_test=True)

        self.assertEqual(sum(g["outcome"] for g in default.groups or []), sum(1 for o in obs if not o.has_site))
        self.assertEqual(sum(g["outcome"] for g in far.groups or []), sum(1 for o in obs if o.nearest_mi > 0.25))
        self.assertEqual([h.name.split()[0] for h in related], ["H1", "H2", "H3", "H4", "H6"])
