"""Source downloads behind one seam: a `.cache/` folder with a 30 day refresh and an injectable HTTP client.

Parsers never touch the network. They read the paths this module returns, so tests run against saved samples.
"""

import gzip
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol, cast

from .model import LATEST_CYCLE, SourceFormatError

REPO_ROOT = Path(__file__).resolve().parents[3]
DATAVERSE = "https://dataverse.harvard.edu/api/access/datafile"
HOUSE_DATAFILE = 13592823
SENATE_DATAFILE = 13887039
HOUSE_FILE = "1976-2024-house.tab"
SENATE_FILE = "1976-2024-senate-state.tab"
PRESIDENT_DATAFILE = 13887042
PRESIDENT_FILE = "1976-2024-president.csv"
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
LEGISLATORS = "https://unitedstates.github.io/congress-legislators"
LEGISLATOR_FILES = ("legislators-current.json", "legislators-historical.json")
ELECTION_LAB = "https://election.lab.ufl.edu"
TURNOUT_MULTI_YEAR = "Turnout_1980_2022_v1.2.csv"
TURNOUT_PAGE_YEARS = (2024, 2026)  # each later general election has its own page naming its current data file
TURNOUT_FILE_ON_PAGE = re.compile(r'"csvfile":"turnoutdata\\?/([A-Za-z0-9_.-]+\.csv)"')
AP_RESULTS = "https://interactives.apelections.org/election-results/data-live"
AP_FILES = ("metadata.json", "progress.json")
AP_HEADERS = {"User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip"}  # the endpoint serves browsers; replies may be gzip encoded
AGENT = {"User-Agent": "election_results pull (https://github.com/davidsouther/resume)"}
CREDENTIAL_NAMES = ("DATAVERSE_API_TOKEN", "DATAVERSE_NAME", "DATAVERSE_EMAIL", "DATAVERSE_INSTITUTION", "DATAVERSE_POSITION")


class SetupError(RuntimeError):
    """The run cannot continue until the user supplies something, such as credentials."""


class Http(Protocol):
    def get(self, url: str, headers: Mapping[str, str]) -> bytes: ...
    def post_json(self, url: str, body: object, headers: Mapping[str, str]) -> bytes: ...


class UrllibHttp:
    """The real client, on the standard library."""

    def get(self, url: str, headers: Mapping[str, str]) -> bytes:
        return self._send(urllib.request.Request(url, headers={**AGENT, **headers}))

    def post_json(self, url: str, body: object, headers: Mapping[str, str]) -> bytes:
        data = json.dumps(body).encode()
        return self._send(urllib.request.Request(url, data=data, method="POST", headers={**AGENT, "Content-Type": "application/json", **headers}))

    def _send(self, request: urllib.request.Request, attempts: int = 6) -> bytes:
        """Retries a rate limited (429) or busy (503) reply, waiting as long as Retry-After asks or doubling from 2 seconds."""
        for attempt in range(attempts):
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    body: bytes = response.read()
                    return decode_body(body, response.headers.get("Content-Encoding"))
            except urllib.error.HTTPError as e:
                if e.code not in (429, 503) or attempt == attempts - 1:
                    raise
                retry_after = e.headers.get("Retry-After", "") if e.headers else ""
                time.sleep(float(retry_after) if retry_after.isdigit() else 2.0 * 2**attempt)
        raise AssertionError("unreachable")


class Sources:
    """Cached source files. A cached file younger than `max_age_days` is reused unless its year is in `refresh_years`."""

    def __init__(
        self,
        cache: Path,
        refresh_years: set[int],
        max_age_days: int = 30,
        http: Http | None = None,
        env: Mapping[str, str] | None = None,
        dotenv: Path | None = REPO_ROOT / ".env",
    ) -> None:
        self.cache = cache
        self.refresh_years = refresh_years
        self.max_age_days = max_age_days
        self.http: Http = http or UrllibHttp()
        self.env: Mapping[str, str] = os.environ if env is None else env
        self.dotenv = dotenv
        self._refetched: set[Path] = set()  # a refreshed year is fetched once per run, not once per call

    def fetch(self, url: str, name: str, year: int | None = None, headers: Mapping[str, str] | None = None) -> Path:
        path = self.cache / name
        if path in self._refetched or self._fresh(path, year):
            return path
        self._store(path, self.http.get(url, headers or {}))
        self._refetched.add(path)
        return path

    def fetched_at(self, path: Path) -> str:
        """The download time of a cached file, as an ISO 8601 UTC timestamp."""
        stamp = datetime.fromtimestamp(path.stat().st_mtime, tz=UTC)
        return stamp.strftime("%Y-%m-%dT%H:%M:%SZ")

    def dataverse_credentials(self) -> dict[str, str]:
        """The token and guestbook answers, from the environment first and then the repo root `.env` file."""
        from_file = _read_dotenv(self.dotenv) if self.dotenv else {}
        found = {name: (self.env.get(name) or from_file.get(name) or "").strip() for name in CREDENTIAL_NAMES}
        missing = [name for name, value in found.items() if not value]
        if missing:
            raise SetupError(_setup_steps(missing, self.dotenv))
        return found

    def medsl_house(self) -> Path:
        """The cached House file. Without one, a guestbook POST returns a signed URL and the file is fetched from it."""
        path = self.cache / HOUSE_FILE
        if path.exists():
            return path
        creds = self.dataverse_credentials()
        guestbook = {
            "guestbookResponse": {
                "name": creds["DATAVERSE_NAME"],
                "email": creds["DATAVERSE_EMAIL"],
                "institution": creds["DATAVERSE_INSTITUTION"],
                "position": creds["DATAVERSE_POSITION"],
            }
        }
        reply = self.http.post_json(f"{DATAVERSE}/{HOUSE_DATAFILE}", guestbook, {"X-Dataverse-key": creds["DATAVERSE_API_TOKEN"]})
        self._store(path, self.http.get(_signed_url(reply), {}))
        return path

    def medsl_senate(self) -> Path:
        return self.fetch(f"{DATAVERSE}/{SENATE_DATAFILE}?format=original", SENATE_FILE)

    def wikipedia_page(self, title: str, year: int) -> dict[str, Any]:
        """The MediaWiki parse API reply (wikitext and revision id) for one page, cached under the election year it describes."""
        query = {"action": "parse", "page": title, "prop": "wikitext|revid", "formatversion": "2", "format": "json", "redirects": "1"}
        path = self.fetch(f"{WIKIPEDIA_API}?{urllib.parse.urlencode(query)}", self._wikipedia_name(title, year), year)
        try:
            payload: object = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            path.unlink(missing_ok=True)
            self._refetched.discard(path)
            raise SourceFormatError(f"Wikipedia: {title}", f"the MediaWiki API did not return JSON ({e})") from e
        if not isinstance(payload, dict):
            raise SourceFormatError(f"Wikipedia: {title}", "the MediaWiki API reply is not an object")
        return cast("dict[str, Any]", payload)

    def wikipedia_fetched_at(self, title: str, year: int) -> str:
        return self.fetched_at(self.cache / self._wikipedia_name(title, year))

    @staticmethod
    def _wikipedia_name(title: str, year: int) -> str:
        return f"wikipedia/{year}/{re.sub(r'[^A-Za-z0-9.-]+', '_', title)}.json"

    def ap_results(self, election_day: str, year: int) -> tuple[Path, Path]:
        """The AP national metadata and progress files for one election day (such as 2026-11-03), cached under `year`."""
        base = f"{AP_RESULTS}/{election_day}/results/national"
        metadata, progress = (self.fetch(f"{base}/{name}", f"ap/{election_day}/{name}", year, AP_HEADERS) for name in AP_FILES)
        return metadata, progress

    def legislators(self) -> list[Path]:
        """The current and historical `unitedstates/congress-legislators` JSON files. The current file refreshes with the latest cycle."""
        current, historical = LEGISLATOR_FILES
        return [
            self.fetch(f"{LEGISLATORS}/{current}", current, LATEST_CYCLE),
            self.fetch(f"{LEGISLATORS}/{historical}", historical),
        ]

    def medsl_president(self) -> Path:
        """The MEDSL President file, an anonymous Dataverse download, doi:10.7910/DVN/42MVDX."""
        return self.fetch(f"{DATAVERSE}/{PRESIDENT_DATAFILE}", PRESIDENT_FILE)

    def election_lab_turnout(self) -> list[tuple[int | None, Path]]:
        """The Election Lab turnout files with the election year each covers, or None for the multi year file.

        A year whose page names no data file yet (before the Election Lab publishes one) is left out.
        """
        base = f"{ELECTION_LAB}/data-downloads/turnoutdata"
        files: list[tuple[int | None, Path]] = [(None, self.fetch(f"{base}/{TURNOUT_MULTI_YEAR}", f"electionlab/{TURNOUT_MULTI_YEAR}"))]
        for year in TURNOUT_PAGE_YEARS:
            page = self.fetch(f"{ELECTION_LAB}/{year}-general-election-turnout/", f"electionlab/{year}-general-election-turnout.html", year)
            m = TURNOUT_FILE_ON_PAGE.search(page.read_text(encoding="utf-8", errors="replace"))
            if m:
                files.append((year, self.fetch(f"{base}/{m.group(1)}", f"electionlab/{m.group(1)}", year)))
        return files

    def _fresh(self, path: Path, year: int | None) -> bool:
        if not path.exists() or (year is not None and year in self.refresh_years):
            return False
        return time.time() - path.stat().st_mtime < self.max_age_days * 86400

    def _store(self, path: Path, body: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_name(path.name + ".partial")
        partial.write_bytes(body)
        partial.replace(path)


def decode_body(body: bytes, encoding: str | None) -> bytes:
    """A reply body with its gzip Content-Encoding removed."""
    return gzip.decompress(body) if (encoding or "").lower() == "gzip" else body


def _signed_url(reply: bytes) -> str:
    payload: object = json.loads(reply)
    data = cast("dict[str, object]", payload).get("data") if isinstance(payload, dict) else None
    url = cast("dict[str, object]", data).get("signedUrl") if isinstance(data, dict) else None
    if not isinstance(url, str):
        raise SetupError("The Dataverse guestbook request returned no signedUrl. Check the token and the guestbook answers.")
    return url


def _read_dotenv(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.removeprefix("export ").split("=", 1)
        values[key.strip()] = value.strip().strip("\"'")
    return values


def _setup_steps(missing: list[str], dotenv: Path | None) -> str:
    where = f"the environment or {dotenv}" if dotenv else "the environment"
    return "\n".join(
        [
            f"The MEDSL House file is not cached in .cache/{HOUSE_FILE}, and downloading it needs Dataverse credentials.",
            f"Missing from {where}: {', '.join(missing)}.",
            "1. Create an API token at https://dataverse.harvard.edu (log in, then API Token in the account menu).",
            "2. Set these variables, either exported in the shell or as NAME=value lines in the repo root .env file:",
            *(f"   {name}" for name in CREDENTIAL_NAMES),
            "   The four guestbook variables answer the dataset's guestbook (your name, email, institution, and position).",
            f"3. Or download {HOUSE_FILE} by hand from doi:10.7910/DVN/IG0UN2 and save it in .cache/.",
        ]
    )
