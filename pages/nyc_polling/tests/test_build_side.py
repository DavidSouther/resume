import tempfile
import unittest
from pathlib import Path
from typing import cast
from unittest import mock

import httpx
from tenacity import wait_none

from nyc_tracts import net
from nyc_tracts.boundaries import Geometry, polygons_of
from nyc_tracts.census import clean_number, fetch_acs, parse_acs_row
from nyc_tracts.dataset import Dataset, LoadOptions, load_dataset, locate_sites
from nyc_tracts.geo import PointLocator
from nyc_tracts.poll_sites import Geocoded, PollSite, election_flag, geocode_sites, google_queries, parse_poll_sites, read_locations, write_locations
from nyc_tracts.poverty import class_index

from . import fakes


class Poverty(unittest.TestCase):
    def test_class_boundaries_are_upper_exclusive(self) -> None:
        self.assertEqual([class_index(v) for v in (0, 9.99, 10, 39.9, 40, 100)], [0, 0, 1, 3, 4, 4])

    def test_missing_rate_has_no_class(self) -> None:
        self.assertIsNone(class_index(None))


class Census(unittest.TestCase):
    def test_sentinels_become_none(self) -> None:
        self.assertEqual([clean_number(v) for v in ("12.5", "-666666666", None, "x")], [12.5, None, None, None])

    def test_row_keeps_raw_values(self) -> None:
        d = fakes.acs_response("005")
        row = parse_acs_row(dict(zip(d[0], d[3], strict=True)))  # kind "300": no poverty data

        self.assertIsNone(row.pov)
        self.assertEqual(row.raw["S1701_C03_001E"], "-666666666")

    def test_fetch_acs_keys_rows_by_geoid(self) -> None:
        with fakes.fake_http():
            rows = fetch_acs("key")

        self.assertEqual(len(rows), 5 * 5)
        self.assertEqual(rows["36005000100"].pov, 5.0)


class Rings(unittest.TestCase):
    def test_rings_with_the_first_ring_winding_are_separate_polygons(self) -> None:
        outer = [[0.0, 0.0], [4.0, 0.0], [4.0, 4.0], [0.0, 4.0], [0.0, 0.0]]
        second_outer = [[10.0, 0.0], [14.0, 0.0], [14.0, 4.0], [10.0, 4.0], [10.0, 0.0]]
        hole = [[1.0, 1.0], [1.0, 3.0], [3.0, 3.0], [3.0, 1.0], [1.0, 1.0]]

        polys = polygons_of({"type": "Polygon", "coordinates": [outer, second_outer, hole]})

        self.assertEqual([len(p) for p in polys], [1, 2])

    def test_unsupported_geometry_raises(self) -> None:
        with self.assertRaises(ValueError):
            polygons_of(cast(Geometry, {"type": "Point", "coordinates": [0, 0]}))

    def test_locator_prefers_earliest_geometry(self) -> None:
        from shapely import box

        locator = PointLocator([box(0, 0, 2, 2), box(1, 1, 3, 3)])

        self.assertEqual((locator.find(1.5, 1.5), locator.find(2.5, 2.5), locator.find(9, 9)), (0, 1, None))


class PollSites(unittest.TestCase):
    def test_parse_splits_sites_from_other_placemarks(self) -> None:
        sites, excluded, total = parse_poll_sites(fakes.poll_kml())

        self.assertEqual((len(sites), total), (3, 4))
        self.assertEqual(excluded, [{"name": "7 minutes", "reason": "route line (no Poll Site ID)"}])
        self.assertEqual([s.source for s in sites], ["kml", None, None])

    def test_election_flags(self) -> None:
        self.assertEqual(
            (election_flag(""), election_flag("Tract 5; 14.5%"), election_flag("General")),
            ("empty Election field", "tract/poverty text in Election field (Tract 5; 14.5%)", None),
        )

    def test_queries_most_specific_first_without_duplicates(self) -> None:
        site = PollSite("School 1", "10 Main St, Apt 2", "", {"Borough": "Bronx", "Zip Code": "10451.0"})

        qs = google_queries(site)

        self.assertEqual(qs[0], "10 Main St, Bronx, NY 10451")
        self.assertEqual(len(qs), len(set(qs)))
        self.assertEqual(qs[-1], "10 Main St, New York, NY 10451")

    def test_geocode_fills_locations_and_reports_failures(self) -> None:
        sites, _, _ = parse_poll_sites(fakes.poll_kml())

        with fakes.fake_http():
            located, geocoded, failed = geocode_sites(sites, "key", pause=0)

        self.assertEqual([s.source for s in located], ["kml", "google", None])
        self.assertEqual([g["name"] for g in geocoded], ["Needs Geocode"])
        self.assertEqual([f["name"] for f in failed], ["Unlocatable"])

    def test_known_sites_are_located_without_calling_the_geocoder(self) -> None:
        sites, _, _ = parse_poll_sites(fakes.poll_kml())
        known: dict[str, Geocoded] = {"2": {"name": "Needs Geocode", "matched": "1 Main St, Bronx, NY", "lonlat": (-73.9, 40.9)}}

        with mock.patch("nyc_tracts.poll_sites.geocode_google", return_value=(None, "no match")) as google:
            located, geocoded, failed = geocode_sites(sites, None, known, pause=0)

        self.assertEqual([s.lonlat for s in located][1], (-73.9, 40.9))
        self.assertEqual(([g["name"] for g in geocoded], [f["name"] for f in failed]), (["Needs Geocode"], ["Unlocatable"]))
        self.assertEqual(google.call_count, 1)  # only the site that is not known

    def test_new_answers_are_added_to_known(self) -> None:
        sites, _, _ = parse_poll_sites(fakes.poll_kml())
        known: dict[str, Geocoded] = {}

        with fakes.fake_http():
            geocode_sites(sites, "key", known, pause=0)

        self.assertEqual(list(known), ["2"])
        self.assertEqual(known["2"]["matched"], "1 Main St, Bronx, NY")

    def test_locations_file_round_trips_sorted_one_site_per_line(self) -> None:
        known: dict[str, Geocoded] = {"20": {"name": "B", "matched": "b", "lonlat": (-73.9, 40.8)}, "10": {"name": "A", "matched": "a", "lonlat": (-74.0, 40.7)}}

        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "data" / "locations.json"
            write_locations(path, known)
            text = path.read_text(encoding="utf-8")

            self.assertEqual(read_locations(path), known)
        self.assertEqual([line.split(":")[0].strip() for line in text.splitlines()[1:-1]], ['"10"', '"20"'])
        self.assertEqual(read_locations(Path(d) / "missing.json"), {})


class Net(unittest.TestCase):
    def test_missing_key_redirect_raises(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/missing_key.html":
                return httpx.Response(200, text="get a key")
            return httpx.Response(302, headers={"Location": "https://api.census.gov/missing_key.html"})

        with mock.patch.object(net, "TRANSPORT", httpx.MockTransport(handler)), self.assertRaises(net.MissingKeyError):
            net.get("https://api.census.gov/data")

    def test_server_errors_are_retried(self) -> None:
        calls: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(str(request.url))
            return httpx.Response(503) if len(calls) < 3 else httpx.Response(200, json={"ok": True})

        with mock.patch.object(net, "TRANSPORT", httpx.MockTransport(handler)):
            body = net._fetch.retry_with(wait=wait_none())("https://example.test/x", 90).json()  # pyright: ignore[reportPrivateUsage]

        self.assertEqual((body, len(calls)), ({"ok": True}, 3))

    def test_client_errors_are_not_retried(self) -> None:
        calls: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(str(request.url))
            return httpx.Response(404)

        with mock.patch.object(net, "TRANSPORT", httpx.MockTransport(handler)), self.assertRaises(httpx.HTTPStatusError):
            net.get("https://example.test/x")

        self.assertEqual(len(calls), 1)


class Build(unittest.TestCase):
    def load(self, skip_polls: bool = False, google_key: str | None = "g", locations: Path | None = None) -> Dataset:
        opts = LoadOptions(census_key="k", google_key=google_key, counties=("005", "061"), skip_polls=skip_polls, locations=locations)
        with fakes.fake_http(), mock.patch("time.sleep"), mock.patch("builtins.print"):
            return load_dataset(opts)

    def test_layers_and_report(self) -> None:
        data = self.load()
        report = data.report
        assert report is not None

        self.assertEqual(report["tracts_by_borough"], {"Bronx": 3, "Manhattan": 3})
        self.assertEqual((len(report["tracts_low_population"]), len(report["tracts_zero_population"])), (2, 2))
        self.assertEqual(report["poverty_class_counts"], {"Under 10%": 2, "20% to 30%": 2, "No data": 2})
        self.assertEqual(report.get("poll_sites_located"), 2)

    def test_tracts_carry_the_acs_facts(self) -> None:
        data = self.load()

        t = next(t for t in data.tracts() if t.geoid == "36005000200")

        self.assertEqual((t.borough, t.poverty, t.income, t.population, t.poverty_moe, t.income_moe), ("Bronx", 25.5, 45000.0, 3500.0, 1.5, 5000.0))
        self.assertEqual(len(data.tracts()), 6)

    def test_excluded_layers(self) -> None:
        ex = self.load().excluded_tracts()

        self.assertEqual({k: len(v) for k, v in ex.items()}, {"zero population": 2, "low population": 2})
        self.assertEqual({t.population for t in ex["zero population"]}, {0.0})
        self.assertTrue(all(t.poverty is None for t in ex["zero population"]))

    def test_site_reports(self) -> None:
        report = self.load().report
        assert report is not None

        self.assertEqual((report.get("with_source_point"), len(report.get("geocoded", [])), len(report.get("geocode_failed", []))), (1, 1, 1))
        self.assertEqual(len(report.get("election_field_flagged", [])), 2)
        self.assertEqual(report.get("sites_without_tract"), [])

    def test_located_sites_know_their_tract(self) -> None:
        data = self.load()

        self.assertEqual([p.name for p in data.polls], ["Has Point", "Needs Geocode"])
        self.assertEqual(data.polls[0].geoid, "36005000100")
        self.assertEqual(data.polls[0].acs.pov if data.polls[0].acs else None, 5.0)
        self.assertEqual([s.name for s in data.sites()], ["Has Point", "Needs Geocode"])

    def test_skip_polls_loads_tracts_only(self) -> None:
        data = self.load(skip_polls=True)

        self.assertEqual((data.polls, data.sites()), ([], []))

    def test_sites_that_need_a_key_stop_the_load(self) -> None:
        with self.assertRaises(RuntimeError):
            self.load(google_key=None)

    def test_new_geocoder_answers_are_saved_and_reused_without_a_key(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "locations.json"
            self.load(locations=path)

            self.assertEqual(list(read_locations(path)), ["2"])
            # The second load has no Google key: the one site that needs geocoding comes from the file. The other unlocatable site still fails.
            with self.assertRaises(RuntimeError):
                self.load(google_key=None, locations=path)
            sites_needing = [s for s in parse_poll_sites(fakes.poll_kml())[0] if s.lonlat is None]
            located, _, failed = geocode_sites(sites_needing, None, read_locations(path), pause=0)
        self.assertEqual(([s.lonlat is not None for s in located], [f["name"] for f in failed]), ([True, False], ["Unlocatable"]))

    def test_options_validate(self) -> None:
        with self.assertRaises(ValueError):
            LoadOptions(counties=("999",)).validate()
        LoadOptions().validate()

    def test_locate_sites_marks_sites_outside_every_tract(self) -> None:
        sites = [PollSite("out", None, "", lonlat=(0.0, 0.0), source="kml")]

        located, no_tract = locate_sites(sites, [], {})

        self.assertEqual(no_tract, ["out"])
        self.assertIsNone(located[0].geoid)
