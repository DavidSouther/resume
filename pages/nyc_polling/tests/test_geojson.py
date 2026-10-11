import json
import os
import tempfile
import unittest

from shapely import MultiPolygon, box
from shapely.geometry import GeometryCollection, LineString

from nyc_tracts.assignment import Subdivision
from nyc_tracts.census import AcsRow
from nyc_tracts.combined import COMBINED
from nyc_tracts.dataset import Dataset
from nyc_tracts.domain import Borough, GeoId, Site, Tract
from nyc_tracts.geojson import build, piece_feature, polygon_geometry, site_feature, zero_population_feature
from nyc_tracts.layers import TractLayers
from nyc_tracts.poll_sites import PollSite


def tract(geoid: str = "36005000200", poverty: float | None = 25.0, population: float | None = 5061.0) -> Tract:
    geom = MultiPolygon([box(0, 0, 2, 1)])
    return Tract(GeoId(geoid), Borough("Bronx"), poverty, 123729.4, geom, (1, 0.5), population)


def piece(miles: float = 0.88, t: Tract | None = None) -> Subdivision:
    return Subdivision(t or tract(), 85002, box(0, 0, 1, 1), Site("1980 Lafayette Avenue", 0.5, 0.5), False, miles)


class Pieces(unittest.TestCase):
    def test_piece_carries_numbers_and_fills(self) -> None:
        p = piece_feature(piece(), "Bronx")["properties"]

        self.assertEqual(
            p,
            {
                "name": "36005000200 / AD 85 ED 002",
                "layer": "Bronx",
                "kind": "piece",
                "geoid": "36005000200",
                "site": "1980 Lafayette Avenue",
                "miles": 0.88,
                "population": 5061,
                "povertyPct": 25.0,
                "incomeUsd": 123729,
                "povertyFill": "#fb6a4a",
                "distanceFill": "#9e9ac8",
                "combinedFill": COMBINED[2][2],
            },
        )

    def test_combined_fill_uses_the_exact_distance_not_the_rounded_one(self) -> None:
        near = piece_feature(piece(miles=0.9996), "Bronx")["properties"]
        far = piece_feature(piece(miles=1.0), "Bronx")["properties"]

        self.assertEqual((near["miles"], far["miles"]), (1.0, 1.0))  # both round to the same figure
        self.assertEqual((near["distanceFill"], far["distanceFill"]), ("#9e9ac8", "#6a51a3"))
        self.assertEqual((near["combinedFill"], far["combinedFill"]), (COMBINED[2][2], COMBINED[2][3]))

    def test_low_population_pieces_are_flagged_and_keep_normal_fills(self) -> None:
        p = piece_feature(piece(), "Low population", low_population=True)["properties"]

        self.assertIs(p["lowPopulation"], True)
        self.assertEqual((p["povertyFill"], p["layer"]), ("#fb6a4a", "Low population"))

    def test_missing_values_are_left_out_and_no_rate_is_no_data(self) -> None:
        p = piece_feature(piece(t=tract(poverty=None, population=None)), "Bronx")["properties"]

        self.assertNotIn("povertyPct", p)
        self.assertNotIn("population", p)
        self.assertEqual((p["povertyFill"], p["combinedFill"]), ("#b5c3d9", "#b5c3d9"))

    def test_geometry_is_a_multipolygon_without_stray_lines(self) -> None:
        mixed = GeometryCollection([box(0, 0, 1, 1), LineString([(0, 0), (1, 1)])])

        g = polygon_geometry(mixed)

        self.assertEqual((g["type"], len(g["coordinates"]), len(g["coordinates"][0][0])), ("MultiPolygon", 1, 5))

    def test_zero_population_tract_has_only_its_population(self) -> None:
        p = zero_population_feature(tract(poverty=None, population=0.0))["properties"]

        self.assertEqual((p["kind"], p["population"], p["layer"]), ("tract", 0, "Zero population"))
        self.assertNotIn("povertyPct", p)


class Sites(unittest.TestCase):
    ROW = AcsRow("Census Tract 1", 19.3, 7.5, 72254.0, 47149.0, 4188.0, 4300.0, 400.0, 1500.0, {})

    def test_site_carries_its_tract_facts_with_margins(self) -> None:
        site = PollSite("18-48 Cornaga Avenue", None, "", {"Site Name": "Sorrentino Recreation Center"}, (-73.8, 40.6), "google", geoid="36081101003", acs=self.ROW)

        f = site_feature(site)

        self.assertEqual(f["geometry"], {"type": "Point", "coordinates": [-73.8, 40.6]})
        self.assertEqual(
            f["properties"],
            {
                "name": "18-48 Cornaga Avenue",
                "layer": "Poll sites",
                "kind": "site",
                "siteName": "Sorrentino Recreation Center",
                "geoid": "36081101003",
                "population": 4188,
                "povertyPct": 19.3,
                "povertyMoe": 7.5,
                "incomeUsd": 72254,
                "incomeMoe": 47149,
            },
        )

    def test_site_outside_every_tract_has_no_tract_facts(self) -> None:
        f = site_feature(PollSite("x", None, "", {}, (-73.8, 40.6), "kml"))

        self.assertEqual(f["properties"], {"name": "x", "layer": "Poll sites", "kind": "site"})


class Build(unittest.TestCase):
    def test_writes_the_two_files_the_page_loads(self) -> None:
        layers = TractLayers(zero=[tract("36005000100", None, 0.0)])
        data = Dataset(layers, polls=[PollSite("x", None, "", {}, (-73.8, 40.6), "kml")])

        with tempfile.TemporaryDirectory() as d:
            counts = build(data, [piece()], [piece(t=tract("36005000300"))], d)

            self.assertEqual(sorted(os.listdir(d)), ["nyc_assignment.geojson", "nyc_poll_sites.geojson"])
            with open(os.path.join(d, "nyc_assignment.geojson"), encoding="utf-8") as f:
                pieces = json.load(f)
        self.assertEqual(counts, {"nyc_assignment.geojson": 3, "nyc_poll_sites.geojson": 1})
        self.assertEqual([x["properties"]["layer"] for x in pieces["features"]], ["Bronx", "Low population", "Zero population"])
        self.assertEqual({k: len(v) for k, v in pieces["legends"].items()}, {"poverty": 7, "distance": 5, "combined": 21})

    def test_coordinates_are_rounded(self) -> None:
        data = Dataset(TractLayers(), polls=[PollSite("x", None, "", {}, (-73.123456789, 40.123456789), "kml")])

        with tempfile.TemporaryDirectory() as d:
            build(data, [], [], d, precision=3)
            with open(os.path.join(d, "nyc_poll_sites.geojson"), encoding="utf-8") as f:
                point = json.load(f)["features"][0]["geometry"]["coordinates"]

        self.assertEqual(point, [-73.123, 40.123])


if __name__ == "__main__":
    unittest.main()
