import json
import os
import tempfile
import time
import unittest
from collections.abc import Iterator, Mapping
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from lib.model import SourceFormatError
from lib.sources import CREDENTIAL_NAMES, HOUSE_FILE, SetupError, Sources

CREDENTIALS = {
    "DATAVERSE_API_TOKEN": "token-value",
    "DATAVERSE_NAME": "A Reporter",
    "DATAVERSE_EMAIL": "reporter@example.test",
    "DATAVERSE_INSTITUTION": "A Newsroom",
    "DATAVERSE_POSITION": "Reporter",
}


class FakeHttp:
    """Records every request and answers the guestbook POST with a signed URL."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, str, object, dict[str, str]]] = []

    def get(self, url: str, headers: Mapping[str, str]) -> bytes:
        self.calls.append(("GET", url, None, dict(headers)))
        return b"body of " + url.encode()

    def post_json(self, url: str, body: object, headers: Mapping[str, str]) -> bytes:
        self.calls.append(("POST", url, body, dict(headers)))
        return json.dumps({"status": "OK", "data": {"signedUrl": "https://signed.test/house"}}).encode()


class UnreadableEnv(Mapping[str, str]):
    """An environment that fails the test if anything reads it."""

    def __getitem__(self, key: str) -> str:
        raise AssertionError(f"read {key}")

    def __iter__(self) -> Iterator[str]:
        raise AssertionError("iterated the environment")

    def __len__(self) -> int:
        raise AssertionError("sized the environment")


class SourcesTestCase(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.cache = self.root / ".cache"
        self.cache.mkdir()
        self.http = FakeHttp()

    def sources(self, env: Mapping[str, str] | None = None, dotenv: Path | None = None, refresh: set[int] | None = None) -> Sources:
        return Sources(self.cache, refresh or set(), http=self.http, env=env if env is not None else {}, dotenv=dotenv)


class FetchTests(SourcesTestCase):
    def test_warm_cache_rerun_makes_no_network_call(self) -> None:
        self.sources().fetch("https://example.test/a", "a.csv")
        self.http.calls.clear()

        path = self.sources().fetch("https://example.test/a", "a.csv")

        self.assertEqual((self.http.calls, path.read_bytes()), ([], b"body of https://example.test/a"))

    def test_entry_older_than_max_age_is_fetched_again(self) -> None:
        path = self.sources().fetch("https://example.test/a", "a.csv")
        old = time.time() - 31 * 86400
        os.utime(path, (old, old))

        self.sources().fetch("https://example.test/a", "a.csv")

        self.assertEqual(len(self.http.calls), 2)

    def test_refresh_year_refetches_only_that_year(self) -> None:
        for year in (2024, 2026):
            self.sources().fetch(f"https://example.test/{year}", f"{year}.json", year=year)
        self.http.calls.clear()

        refreshing = self.sources(refresh={2026})
        refreshing.fetch("https://example.test/2024", "2024.json", year=2024)
        refreshing.fetch("https://example.test/2026", "2026.json", year=2026)

        self.assertEqual([c[1] for c in self.http.calls], ["https://example.test/2026"])


class TurnoutHttp(FakeHttp):
    """Serves an Election Lab year page that names its data file for 2024, and one that names none yet for 2026."""

    def get(self, url: str, headers: Mapping[str, str]) -> bytes:
        self.calls.append(("GET", url, None, dict(headers)))
        if url.endswith("/2024-general-election-turnout/"):
            return b'createCsvTable("t", {"csvfile":"turnoutdata\\/Turnout_2024G_v0.4.csv","columns":[]});'
        if url.endswith("-general-election-turnout/"):
            return b"<html>no table yet</html>"
        return b"STATE,STATE_ABV\n"


class EnrichmentSourceTests(SourcesTestCase):
    def test_legislators_and_president_come_from_their_public_urls(self) -> None:
        current, historical = self.sources().legislators()
        president = self.sources().medsl_president()

        self.assertEqual((current.name, historical.name, president.name), ("legislators-current.json", "legislators-historical.json", "1976-2024-president.csv"))
        self.assertEqual(
            [c[1] for c in self.http.calls],
            [
                "https://unitedstates.github.io/congress-legislators/legislators-current.json",
                "https://unitedstates.github.io/congress-legislators/legislators-historical.json",
                "https://dataverse.harvard.edu/api/access/datafile/13887042",
            ],
        )

    def test_refresh_2026_refetches_only_the_current_legislators(self) -> None:
        self.sources().legislators()
        self.http.calls.clear()

        self.sources(refresh={2026}).legislators()

        self.assertEqual([c[1].rsplit("/", 1)[1] for c in self.http.calls], ["legislators-current.json"])

    def test_ap_results_fetch_both_files_with_a_browser_agent_and_refresh_with_their_year(self) -> None:
        metadata, progress = self.sources().ap_results("2026-11-03", 2026)
        self.sources().ap_results("2026-11-03", 2026)

        base = "https://interactives.apelections.org/election-results/data-live/2026-11-03/results/national"
        self.assertEqual([c[1] for c in self.http.calls], [f"{base}/metadata.json", f"{base}/progress.json"])
        self.assertEqual({c[3]["User-Agent"] for c in self.http.calls}, {"Mozilla/5.0"})
        self.assertEqual((metadata.relative_to(self.cache).as_posix(), progress.name), ("ap/2026-11-03/metadata.json", "progress.json"))
        self.http.calls.clear()

        self.sources(refresh={2026}).ap_results("2026-11-03", 2026)

        self.assertEqual(len(self.http.calls), 2)

    def test_turnout_reads_the_data_file_each_year_page_names_and_skips_a_year_with_none(self) -> None:
        self.http = TurnoutHttp()

        files = self.sources().election_lab_turnout()

        self.assertEqual([(year, path.name) for year, path in files], [(None, "Turnout_1980_2022_v1.2.csv"), (2024, "Turnout_2024G_v0.4.csv")])
        self.assertIn("https://election.lab.ufl.edu/data-downloads/turnoutdata/Turnout_2024G_v0.4.csv", [c[1] for c in self.http.calls])


class WikiHttp(FakeHttp):
    """Answers every MediaWiki API request with a parse result named after the requested page."""

    def get(self, url: str, headers: Mapping[str, str]) -> bytes:
        self.calls.append(("GET", url, None, dict(headers)))
        title = parse_qs(urlparse(url).query)["page"][0]
        return json.dumps({"parse": {"title": title, "pageid": 1, "revid": 2, "wikitext": "text"}}).encode()


class WikipediaTests(SourcesTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.http = WikiHttp()

    def test_page_is_fetched_once_and_then_read_from_the_cache(self) -> None:
        first = self.sources().wikipedia_page("2018 Georgia gubernatorial election", 2018)
        second = self.sources().wikipedia_page("2018 Georgia gubernatorial election", 2018)

        self.assertEqual((first, second), (second, {"parse": {"title": "2018 Georgia gubernatorial election", "pageid": 1, "revid": 2, "wikitext": "text"}}))
        self.assertEqual(len(self.http.calls), 1)
        query = parse_qs(urlparse(self.http.calls[0][1]).query)
        self.assertEqual((query["action"], query["prop"], query["format"]), (["parse"], ["wikitext|revid"], ["json"]))

    def test_refresh_2026_refetches_only_2026_pages_once_per_run(self) -> None:
        self.sources().wikipedia_page("2018 Georgia gubernatorial election", 2018)
        self.sources().wikipedia_page("2026 Georgia gubernatorial election", 2026)
        self.http.calls.clear()

        refreshing = self.sources(refresh={2026})
        for _ in range(2):
            refreshing.wikipedia_page("2018 Georgia gubernatorial election", 2018)
            refreshing.wikipedia_page("2026 Georgia gubernatorial election", 2026)

        self.assertEqual([parse_qs(urlparse(c[1]).query)["page"] for c in self.http.calls], [["2026 Georgia gubernatorial election"]])

    def test_a_reply_that_is_not_json_raises_and_is_not_cached(self) -> None:
        self.http.get = lambda url, headers: b"<html>busy</html>"  # type: ignore[method-assign]

        with self.assertRaises(SourceFormatError):
            self.sources().wikipedia_page("2018 Georgia gubernatorial election", 2018)

        self.assertEqual(list(self.cache.rglob("*.json")), [])


class HouseTests(SourcesTestCase):
    def test_cached_house_file_reads_no_variables_and_makes_no_request(self) -> None:
        (self.cache / HOUSE_FILE).write_text("cached")

        path = self.sources(env=UnreadableEnv(), dotenv=self.root / "missing.env").medsl_house()

        self.assertEqual((path.read_text(), self.http.calls), ("cached", []))

    def test_missing_variables_stop_with_setup_steps_and_no_request(self) -> None:
        with self.assertRaises(SetupError) as caught:
            self.sources(env={"DATAVERSE_API_TOKEN": "x"}, dotenv=self.root / "missing.env").medsl_house()

        message = str(caught.exception)
        for name in CREDENTIAL_NAMES:
            self.assertIn(name, message)
        self.assertNotIn("x\n", message)
        self.assertEqual(self.http.calls, [])

    def test_variables_from_the_environment_post_the_guestbook_then_fetch_the_signed_url(self) -> None:
        path = self.sources(env=CREDENTIALS).medsl_house()

        self.assertGuestbookFlow(path)

    def test_variables_from_a_dotenv_file_post_the_guestbook_then_fetch_the_signed_url(self) -> None:
        dotenv = self.root / ".env"
        dotenv.write_text("# comment\n" + "".join(f'{k}="{v}"\n' for k, v in CREDENTIALS.items()))

        path = self.sources(env={}, dotenv=dotenv).medsl_house()

        self.assertGuestbookFlow(path)

    def assertGuestbookFlow(self, path: Path) -> None:
        (post, get) = self.http.calls
        self.assertEqual((post[0], post[1]), ("POST", "https://dataverse.harvard.edu/api/access/datafile/13592823"))
        self.assertEqual(post[2], {"guestbookResponse": {"name": "A Reporter", "email": "reporter@example.test", "institution": "A Newsroom", "position": "Reporter"}})
        self.assertEqual(post[3]["X-Dataverse-key"], "token-value")
        self.assertEqual((get[0], get[1]), ("GET", "https://signed.test/house"))
        self.assertNotIn("X-Dataverse-key", get[3])
        self.assertEqual((path.name, path.read_bytes()), (HOUSE_FILE, b"body of https://signed.test/house"))


if __name__ == "__main__":
    unittest.main()
