import unittest

from shapely import box

from nyc_tracts.geography.boe import ElectionDistrict
from nyc_tracts.geography.tract_district import overlay_tracts
from nyc_tracts.kernel.domain import Borough, GeoId, Site, Tract


def tract(geoid: str, x0: float, x1: float, poverty: float = 10.0) -> Tract:
    return Tract(GeoId(geoid), Borough("Bronx"), poverty, 50000.0, box(x0, 0, x1, 1), ((x0 + x1) / 2, 0.5))


class TractDistrict(unittest.TestCase):
    def setUp(self) -> None:
        self.a, self.b = tract("A", 0, 2), tract("B", 2, 4, poverty=30.0)
        self.site_in_a = Site("in A", 1.0, 0.5)
        self.site_in_b = Site("in B", 3.0, 0.5)

    def test_tract_inside_one_district_is_one_tract_district(self) -> None:
        districts = [ElectionDistrict(1, box(0, 0, 2, 1)), ElectionDistrict(2, box(2, 0, 4, 1))]

        divided = overlay_tracts([self.a, self.b], districts, {1: self.site_in_a, 2: self.site_in_a})

        self.assertEqual([(s.tract.geoid, s.elect_dist, s.site_in_tract) for s in divided.tract_districts], [("A", 1, True), ("B", 2, False)])
        self.assertEqual(divided.uncovered, [])

    def test_tract_spanning_districts_splits_and_keeps_its_poverty_rate(self) -> None:
        districts = [ElectionDistrict(1, box(0, 0, 0.5, 1)), ElectionDistrict(2, box(0.5, 0, 4, 1))]

        divided = overlay_tracts([self.b], districts, {1: self.site_in_a, 2: self.site_in_b})

        self.assertEqual(len(divided.tract_districts), 1)  # B (x from 2 to 4) only touches district 2
        spanning = overlay_tracts([self.a], districts, {1: self.site_in_b, 2: self.site_in_a}).tract_districts
        self.assertEqual([(s.elect_dist, s.site_in_tract) for s in spanning], [(1, False), (2, True)])
        self.assertEqual({s.tract.poverty for s in spanning}, {10.0})
        self.assertAlmostEqual(sum(s.geometry.area for s in spanning), 2.0)

    def test_tract_with_no_district_is_reported_uncovered(self) -> None:
        divided = overlay_tracts([self.a], [ElectionDistrict(2, box(10, 0, 11, 1))], {2: self.site_in_b})

        self.assertEqual(divided.tract_districts, [])
        self.assertEqual(divided.uncovered, [self.a])

    def test_boundary_slivers_are_dropped(self) -> None:
        sliver = ElectionDistrict(2, box(1.9999999, 0, 2.5, 1))  # overlaps tract A by a hair along the shared edge
        districts = [ElectionDistrict(1, box(0, 0, 1.9999999, 1)), sliver]

        divided = overlay_tracts([self.a], districts, {1: self.site_in_a, 2: self.site_in_b})

        self.assertEqual([s.elect_dist for s in divided.tract_districts], [1])
        self.assertEqual(divided.slivers_dropped, 1)

    def test_distance_is_from_the_tract_district_centroid(self) -> None:
        far = Site("far", 5.0, 0.5)

        divided = overlay_tracts([self.a], [ElectionDistrict(1, box(0, 0, 1, 1))], {1: far})

        self.assertAlmostEqual(divided.tract_districts[0].miles, far.miles_to(0.5, 0.5), places=6)
