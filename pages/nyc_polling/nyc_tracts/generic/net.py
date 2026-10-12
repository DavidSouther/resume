"""HTTP GET through httpx, retried with tenacity, with an optional local cache of source files.

Tests set TRANSPORT to an httpx.MockTransport. The source data (Census tables, tract boundaries, poll site
lists, geocoder answers, BOE PDFs) changes rarely, so `use_cache` keeps each successful response on disk and
reuses it until it is older than `max_age_days`. A cache key is the URL without its `key` parameter, so API keys
are never written to disk."""

import argparse
import hashlib
import time
import urllib.parse
from dataclasses import dataclass
from pathlib import Path

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

TRANSPORT: httpx.BaseTransport | None = None
USER_AGENT = "nyc_tracts_poll_sites/1.0"


@dataclass(frozen=True)
class Cache:
    directory: Path
    max_age_days: float = 30.0
    refresh: bool = False  # fetch again and overwrite, ignoring what is stored


active_cache: Cache | None = None


def use_cache(directory: Path | None, max_age_days: float = 30.0, refresh: bool = False) -> None:
    """Turn the response cache on (or off, with None) for the rest of the process."""
    global active_cache
    active_cache = Cache(directory, max_age_days, refresh) if directory is not None else None


class MissingKeyError(RuntimeError):
    """The Census API redirected to its missing or invalid key page."""


def cache_key(url: str) -> str:
    """The URL without its API key, which names the cache entry and is all that is stored about the request."""
    parts = urllib.parse.urlsplit(url)
    query = [(k, v) for k, v in urllib.parse.parse_qsl(parts.query, keep_blank_values=True) if k.lower() != "key"]
    return urllib.parse.urlunsplit(parts._replace(query=urllib.parse.urlencode(query)))


def _paths(cache: Cache, url: str) -> tuple[Path, Path]:
    stem = hashlib.sha256(cache_key(url).encode()).hexdigest()[:32]
    return cache.directory / f"{stem}.body", cache.directory / f"{stem}.url"


def _cached(cache: Cache, url: str) -> bytes | None:
    body, _ = _paths(cache, url)
    if cache.refresh or not body.exists():
        return None
    age_days = (time.time() - body.stat().st_mtime) / 86400
    return body.read_bytes() if age_days <= cache.max_age_days else None


def _store(cache: Cache, url: str, content: bytes) -> None:
    body, label = _paths(cache, url)
    cache.directory.mkdir(parents=True, exist_ok=True)
    body.write_bytes(content)
    label.write_text(cache_key(url) + "\n", encoding="utf-8")  # for a person looking in the folder


def _transient(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code >= 500
    return isinstance(exc, httpx.TransportError)


@retry(retry=retry_if_exception(_transient), stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2), reraise=True)
def _fetch(url: str, timeout: float) -> httpx.Response:
    with httpx.Client(transport=TRANSPORT, timeout=timeout, follow_redirects=True, headers={"User-Agent": USER_AGENT}) as client:
        resp = client.get(url)
    final = str(resp.url)
    if "missing_key" in final or "invalid_key" in final:
        raise MissingKeyError(f"Census API rejected request: missing or invalid key (redirected to {final}). A new key must be activated from the confirmation email first.")
    return resp.raise_for_status()


def get(url: str, timeout: float = 90) -> httpx.Response:
    """GET a URL, from the cache when it has a fresh copy. Only successful responses are cached."""
    cache = active_cache
    if cache is not None and (content := _cached(cache, url)) is not None:
        return httpx.Response(200, content=content, request=httpx.Request("GET", url))
    resp = _fetch(url, timeout)
    if cache is not None:
        _store(cache, url, resp.content)
    return resp


def add_cache_arguments(ap: argparse.ArgumentParser, default_dir: Path) -> None:
    ap.add_argument("--cache-dir", type=Path, default=default_dir, help=f"where downloaded source files are kept (default {default_dir})")
    ap.add_argument("--max-age-days", type=float, default=30.0, help="reuse a cached source file this long (default 30)")
    ap.add_argument("--refresh", action="store_true", help="download every source again and replace the cache")
    ap.add_argument("--no-cache", action="store_true", help="do not read or write the cache")


def use_cache_from(args: argparse.Namespace) -> None:
    """Configure the cache from the flags add_cache_arguments added."""
    use_cache(None if args.no_cache else args.cache_dir, args.max_age_days, args.refresh)


def get_json(url: str, timeout: float = 90) -> object:
    """Parsed JSON body. Callers cast it to the TypedDict they expect."""
    return get(url, timeout).json()
