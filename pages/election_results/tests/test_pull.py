import contextlib
import csv
import io
import json
import shutil
import tempfile
import unittest
from collections.abc import Mapping
from pathlib import Path
from unittest import mock
from urllib.parse import parse_qs, urlparse

import pull
from lib import sources
from lib.model import RaceRow, State
from lib.output import write_csvs
from lib.source_table import SourceTable, join_sources

SAMPLES = Path(__file__).parent / "samples"
REAL_DATA = Path(__file__).resolve().parent.parent / "data"
TEST_SOURCE_ID = 9999  # the id the fixtures cite for their hand entered rows


WIKI_SAMPLES = {
    "2010 Alaska gubernatorial election": "wiki_gov_2010_ak.json",
    "2013 Virginia gubernatorial election": "wiki_gov_2013_va.json",
    "2013 Virginia gubernatorial special election": "wiki_gov_2013_va.json",  # a redirect to the same page
    "2014 Alaska gubernatorial election": "wiki_gov_2014_ak.json",
    "2017 Virginia gubernatorial election": "wiki_gov_2017_va.json",
    "2018 Georgia gubernatorial election": "wiki_gov_2018_ga.json",
    "2026 United States Senate election in Texas": "wiki_sen_2026_tx.json",
    "2026 United States Senate special election in Ohio": "wiki_sen_2026_oh.json",
    "2026 United States House of Representatives elections in Texas": "wiki_house_2026_tx.json",
}
OVERVIEW_LINKS = {
    "2010 United States gubernatorial elections": ["2010 Alaska gubernatorial election"],
    "2013 United States gubernatorial elections": [
        "2013 Virginia gubernatorial election",
        "2013 New Jersey gubernatorial election",
        "2013 Virginia gubernatorial special election",
    ],
    "2014 United States gubernatorial elections": ["2014 Alaska gubernatorial election", "2014 Guamanian gubernatorial election"],
    "2017 United States gubernatorial elections": ["2017 Virginia gubernatorial election"],
    "2018 United States gubernatorial elections": ["2018 Georgia gubernatorial election"],
    "2026 United States Senate elections": ["2026 United States Senate election in Texas", "2026 United States Senate special election in Ohio"],
}
calls: list[str] = []
ap_missing: set[str] = set()  # AP race ids left out of the served AP files


def ap_source(url: str) -> bytes:
    """Serves the trimmed AP metadata and progress samples, without the races in `ap_missing`."""
    name = "ap_2026_metadata.json" if url.endswith("/metadata.json") else "ap_2026_progress.json"
    payload: dict[str, object] = json.loads((SAMPLES / name).read_text())
    return json.dumps({k: v for k, v in payload.items() if k not in ap_missing}).encode()


def no_network(*_args: object) -> bytes:
    raise AssertionError("network call during a warm cache run")


ENRICHMENT_SAMPLES = {
    "legislators-current.json": "legislators_sample.json",
    "datafile/13887042": "medsl_president_sample.csv",
    "Turnout_1980_2022_v1.2.csv": "electionlab_1980_2022_sample.csv",
    "Turnout_2024G_v0.4.csv": "electionlab_2024_sample.csv",
    "Turnout_2026G_v0.2.csv": "electionlab_2026_sample.csv",
}


def enrichment_source(url: str) -> bytes:
    """Serves the legislators, president, and Election Lab samples, and an Election Lab year page naming its data file."""
    for suffix, sample in ENRICHMENT_SAMPLES.items():
        if url.endswith(suffix):
            return (SAMPLES / sample).read_bytes()
    if url.endswith("legislators-historical.json"):
        return b"[]"
    for year, name in ((2024, "Turnout_2024G_v0.4.csv"), (2026, "Turnout_2026G_v0.2.csv")):
        if url.endswith(f"/{year}-general-election-turnout/"):
            return ('{"csvfile":"turnoutdata\\/' + name + '"}').encode()
    raise AssertionError(f"unexpected request {url}")


def wikipedia(_self: object, url: str, _headers: Mapping[str, str]) -> bytes:
    """Serves saved pages by title, overview pages as link lists, and a missing page error for anything else."""
    if "apelections.org" in url:
        return ap_source(url)
    if "wikipedia.org" not in url:
        return enrichment_source(url)
    title = parse_qs(urlparse(url).query)["page"][0]
    calls.append(title)
    if title in WIKI_SAMPLES:
        return (SAMPLES / WIKI_SAMPLES[title]).read_bytes()
    if title in OVERVIEW_LINKS or title.endswith(("gubernatorial elections", "Senate elections")):
        text = "\n".join(f"* [[{t}]]" for t in OVERVIEW_LINKS.get(title, []))
        return json.dumps({"parse": {"title": title, "pageid": 1, "revid": 1, "wikitext": text}}).encode()
    return json.dumps({"error": {"code": "missingtitle", "info": "The page you specified doesn't exist."}}).encode()


class PullCase(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.cache = self.root / "cache"
        self.data = self.root / "data"
        (self.data / "overrides").mkdir(parents=True)
        self.cache.mkdir()
        shutil.copy(SAMPLES / "medsl_senate_sample.csv", self.cache / sources.SENATE_FILE)
        shutil.copy(SAMPLES / "medsl_house_wrapped.tab", self.cache / sources.HOUSE_FILE)
        self.overrides = self.data / "overrides" / "result_overrides.csv"
        self.overrides.write_text("year,state,office,seat,special,round,candidate,party,votes,official,source_id\n")
        self.sources = self.data / "sources.csv"  # copies, so the committed files are never rewritten; the redistricting file cites ids of the table
        shutil.copy(REAL_DATA / "sources.csv", self.sources)
        shutil.copy(REAL_DATA / "overrides" / "redistricting.csv", self.data / "overrides" / "redistricting.csv")
        with self.sources.open("a") as f:
            f.write(f"{TEST_SOURCE_ID},test,,2026-11-05\n")
        calls.clear()
        ap_missing.clear()
        patcher = mock.patch.multiple(sources.UrllibHttp, get=wikipedia, post_json=no_network)
        patcher.start()
        self.addCleanup(patcher.stop)

    def pulled(self) -> list[Path]:
        """The CSVs a pull writes, which leaves out the sources table the test started with."""
        return [p for p in self.data.glob("*.csv") if p.name != "sources.csv"]

    def run_pull(self, *extra: str) -> tuple[int, str]:
        err = io.StringIO()
        with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
            code = pull.main(["--data", str(self.data), "--cache", str(self.cache), *extra])
        return code, err.getvalue()

    def read(self, name: str) -> list[dict[str, str]]:
        """The file's rows, with `source` and `fetched_at` joined from the sources table where the file cites a `source_id`."""
        with (self.data / name).open() as f:
            rows = list(csv.DictReader(f))
        return join_sources(rows, SourceTable.load(self.sources)) if rows and "source_id" in rows[0] else rows


class PullTests(PullCase):
    def test_warm_cache_writes_window_and_baseline_files(self) -> None:
        code, _ = self.run_pull()

        self.assertEqual(code, 0)
        races = self.read("races.csv")
        self.assertEqual({r["year"] for r in races}, {"2018", "2020", "2014", "2017", "2024", "2026"})
        self.assertEqual({r["year"] for r in self.read("baseline_races.csv")}, {"2010", "2012", "2013"})
        cruz = next(r for r in races if r["state"] == "TX" and r["office"] == "senate")
        self.assertEqual((cruz["gop_candidate"], cruz["gop_pct"], cruz["special"], cruz["incumbent_name"]), ("Ted Cruz", "50.8926", "false", "Ted Cruz"))
        self.assertIn("redrawn", races[0])
        self.assertIn("fetched_at", self.read("candidates.csv")[0])

    def test_governors_land_in_the_window_and_their_priors_in_the_baseline(self) -> None:
        self.run_pull()

        window = {(r["year"], r["state"]) for r in self.read("races.csv") if r["office"] == "governor"}
        baseline = {(r["year"], r["state"]) for r in self.read("baseline_races.csv") if r["office"] == "governor"}
        self.assertEqual(window, {("2014", "AK"), ("2017", "VA"), ("2018", "GA"), ("2026", "GA")})  # 2026 GA comes from the AP sample
        self.assertEqual(baseline, {("2010", "AK"), ("2013", "VA")})
        va = [r for r in self.read("baseline_candidates.csv") if r["state"] == "VA" and r["year"] == "2013"]
        self.assertEqual(len(va), len({r["candidate"] for r in va}))  # a redirect to a page already read adds nothing
        ga = next(r for r in self.read("races.csv") if r["office"] == "governor" and r["state"] == "GA")
        self.assertEqual((ga["gop_candidate"], ga["gop_pct"], ga["dem_candidate"]), ("Brian Kemp", "50.2209", "Stacey Abrams"))

    def test_2026_races_come_from_ap_and_unreadable_wikipedia_ones_go_to_the_load_report(self) -> None:
        self.run_pull()

        races_2026 = [r for r in self.read("races.csv") if r["year"] == "2026"]
        senate_2026 = {(r["state"], r["special"], r["official"], r["source"]) for r in races_2026 if r["office"] == "senate"}
        self.assertEqual(senate_2026, {("TX", "false", "false", "ap"), ("OH", "true", "false", "ap")})
        self.assertEqual({r["source"] for r in self.read("candidates.csv") if r["year"] == "2026"}, {"ap"})
        frost = next(r for r in races_2026 if (r["state"], r["seat"]) == ("FL", "10"))
        self.assertEqual((frost["dem_candidate"], frost["dem_votes"], frost["total_votes"], frost["winner_party"]), ("Maxwell Frost", "", "", "DEM"))
        report = (self.data / "load_report.txt").read_text()
        self.assertIn("2026 TX house district 1: the general election box has no votes", report)  # AP lacks it, so Wikipedia's note stays
        self.assertNotIn("2026 OH senate special: partial", report)  # AP covers it
        self.assertIn("2026 AK house district 0: eevp 73.98", report)
        self.assertIn("20261103US999999", report)
        self.assertIn("2013 New Jersey gubernatorial election: The page you specified doesn't exist.", report)
        self.assertNotIn("Guamanian", report)

    def test_wikipedia_fills_a_2026_race_ap_lacks(self) -> None:
        ap_missing.add("20261103TX46643")

        self.run_pull()

        tx = next(r for r in self.read("races.csv") if (r["year"], r["state"], r["office"]) == ("2026", "TX", "senate"))
        self.assertTrue(tx["source"].startswith("Wikipedia: 2026 United States Senate election in Texas"), tx["source"])

    def test_warm_cache_rerun_makes_no_network_call(self) -> None:
        self.run_pull()

        with mock.patch.object(sources.UrllibHttp, "get", no_network):
            code, err = self.run_pull()

        self.assertEqual((code, err), (0, ""))

    def test_refresh_2026_refetches_only_2026_pages(self) -> None:
        self.run_pull()
        calls.clear()

        self.run_pull("--refresh", "2026")

        self.assertTrue(calls)
        self.assertTrue(all(title.startswith("2026 ") for title in calls), calls)
        self.assertEqual(len(calls), len(set(calls)))

    def test_overrides_decide_rounds_in_the_written_races(self) -> None:
        self.overrides.write_text(
            self.overrides.read_text() + f"2018,TX,senate,1,false,runoff,Beto O'Rourke,DEM,10,true,{TEST_SOURCE_ID}\n2018,TX,senate,1,false,runoff,Ted Cruz,REP,5,true,{TEST_SOURCE_ID}\n"
        )

        self.run_pull()

        tx = next(r for r in self.read("races.csv") if r["state"] == "TX" and r["office"] == "senate" and r["year"] == "2018")
        self.assertEqual((tx["round"], tx["dem_votes"], tx["winner_party"]), ("runoff", "10", "DEM"))

    def test_source_missing_a_column_fails_naming_it_and_writes_no_csv(self) -> None:
        senate = self.cache / sources.SENATE_FILE
        lines = senate.read_text().splitlines()
        senate.write_text("\n".join([lines[0].replace(",party_simplified", ",party_x"), *lines[1:]]) + "\n")

        code, err = self.run_pull()

        self.assertEqual(code, 1)
        self.assertIn("party_simplified", err)
        self.assertEqual(self.pulled(), [])


class EnrichmentPullTests(PullCase):
    def test_races_carry_incumbency_and_the_lookups_are_written(self) -> None:
        code, _ = self.run_pull()

        self.assertEqual(code, 0)
        races = self.read("races.csv")
        cruz = next(r for r in races if r["state"] == "TX" and r["office"] == "senate" and r["year"] == "2018")
        self.assertEqual((cruz["incumbent_party"], cruz["incumbent_running"], cruz["paired_incumbents"]), ("REP", "true", "false"))
        ohio = next(r for r in races if r["state"] == "OH" and r["office"] == "senate" and r["year"] == "2026")
        self.assertEqual((ohio["incumbent_party"], ohio["incumbent_running"]), ("REP", "false"))
        georgia = next(r for r in races if r["state"] == "GA" and r["office"] == "governor")
        self.assertEqual((georgia["incumbent_name"], georgia["incumbent_party"], georgia["incumbent_running"]), ("Nathan Deal", "REP", "false"))
        flagged = {(r["year"], r["candidate"]) for r in self.read("candidates.csv") if r["incumbent"] == "true"}
        self.assertIn(("2018", "Ted Cruz"), flagged)
        self.assertNotIn(("2026", "Jon Husted"), flagged)
        lean = {(r["state"], r["year"]): r["lean"] for r in self.read("presidential_lean.csv")}
        self.assertEqual((lean[("PA", "2026")], lean[("TX", "2022")], lean[("GA", "2022")]), ("swing", "red", "swing"))
        delegation = {(r["state"], r["year"]): r["lean"] for r in self.read("senate_delegation.csv")}
        self.assertEqual(delegation[("ME", "2026")], "purple")
        turnout = {(r["state"], r["year"]): r for r in self.read("turnout.csv")}
        self.assertEqual((turnout[("TX", "2026")]["total_ballots"], turnout[("TX", "2026")]["official"]), ("9975000", "false"))
        self.assertEqual(turnout[("TX", "2008")]["total_ballots"], "")
        self.assertIn("fewer than two senators", (self.data / "load_report.txt").read_text())

    def test_redistricting_file_missing_a_column_fails_naming_it_and_writes_no_csv(self) -> None:
        broken = self.data / "overrides" / "redistricting.csv"
        broken.write_text("state,first_election_year,kind\nTX,2026,mid_cycle\n")

        code, err = self.run_pull()

        self.assertEqual(code, 1)
        self.assertIn("'source_id'", err)
        self.assertEqual(self.pulled(), [])

    def test_legislators_file_missing_a_key_fails_naming_it_and_writes_no_csv(self) -> None:
        self.run_pull()
        for path in self.pulled():
            path.unlink()
        (self.cache / "legislators-current.json").write_text('[{"id": {"bioguide": "X1"}, "name": {"first": "A", "last": "B"}, "terms": [{"type": "sen"}]}]')

        code, err = self.run_pull()

        self.assertEqual(code, 1)
        self.assertIn("'start'", err)
        self.assertEqual(self.pulled(), [])


class WriteCsvTests(unittest.TestCase):
    def test_booleans_are_lowercase_and_nulls_are_empty(self) -> None:
        race = RaceRow(
            year=2020, state=State("CA"), office="house", seat=12, special=False, round="general", dem_candidate="A", dem_votes=10, dem_pct=100.0,
            gop_candidate=None, gop_votes=None, gop_pct=None, other_votes=0, total_votes=10, winner_party="DEM", incumbent_name=None,
            incumbent_party=None, incumbent_running=True, paired_incumbents=False, redrawn=False, unofficial=False, source="s",
        )  # fmt: skip
        with tempfile.TemporaryDirectory() as tmp:
            write_csvs(Path(tmp), races=[race])
            (row,) = csv.DictReader((Path(tmp) / "races.csv").open())

        self.assertEqual((row["incumbent_running"], row["redrawn"], row["gop_pct"], row["dem_pct"]), ("true", "false", "", "100.0"))


if __name__ == "__main__":
    unittest.main()
