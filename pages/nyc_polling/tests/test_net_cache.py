import tempfile
import time
import unittest
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path
from unittest import mock

import httpx

from nyc_tracts import net


class Transport:
    """A mock network that counts requests."""

    def __init__(self, status: int = 200) -> None:
        self.urls: list[str] = []
        self.status = status

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.urls.append(str(request.url))
        return httpx.Response(self.status, content=b"body %d" % len(self.urls))


@contextmanager
def network(transport: Transport, cache: Path | None, **options: float | bool) -> Generator[None]:
    with mock.patch.object(net, "TRANSPORT", httpx.MockTransport(transport)), mock.patch.object(net, "active_cache", None):
        net.use_cache(cache, **options)  # pyright: ignore[reportArgumentType]
        yield


class CacheTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)

    def test_second_get_is_served_from_disk(self) -> None:
        net_calls = Transport()

        with network(net_calls, self.dir):
            first = net.get("https://example.test/a").content
            second = net.get("https://example.test/a").content

        self.assertEqual((first, second, len(net_calls.urls)), (b"body 1", b"body 1", 1))

    def test_no_cache_means_every_get_hits_the_network(self) -> None:
        net_calls = Transport()

        with network(net_calls, None):
            net.get("https://example.test/a")
            net.get("https://example.test/a")

        self.assertEqual(len(net_calls.urls), 2)

    def test_api_key_is_neither_part_of_the_cache_key_nor_written_to_disk(self) -> None:
        net_calls = Transport()

        with network(net_calls, self.dir):
            net.get("https://api.test/data?get=A&key=SECRET1")
            net.get("https://api.test/data?get=A&key=SECRET2")  # same data, another key

        self.assertEqual(len(net_calls.urls), 1)
        self.assertEqual(net.cache_key("https://api.test/data?get=A&key=SECRET1"), "https://api.test/data?get=A")
        written = b"".join(p.read_bytes() for p in self.dir.iterdir())
        self.assertNotIn(b"SECRET", written)

    def test_stale_entries_are_fetched_again(self) -> None:
        net_calls = Transport()
        with network(net_calls, self.dir, max_age_days=1.0):
            net.get("https://example.test/a")
            for p in self.dir.glob("*.body"):
                old = time.time() - 3 * 86400
                import os

                os.utime(p, (old, old))

            net.get("https://example.test/a")

        self.assertEqual(len(net_calls.urls), 2)

    def test_refresh_ignores_and_replaces_the_cache(self) -> None:
        net_calls = Transport()
        with network(net_calls, self.dir):
            net.get("https://example.test/a")
        with network(net_calls, self.dir, refresh=True):
            again = net.get("https://example.test/a").content
        with network(net_calls, self.dir):
            after = net.get("https://example.test/a").content

        self.assertEqual((again, after, len(net_calls.urls)), (b"body 2", b"body 2", 2))

    def test_failed_responses_are_not_cached(self) -> None:
        net_calls = Transport(status=404)

        with network(net_calls, self.dir), self.assertRaises(httpx.HTTPStatusError):
            net.get("https://example.test/missing")

        self.assertEqual(list(self.dir.iterdir()), [])
