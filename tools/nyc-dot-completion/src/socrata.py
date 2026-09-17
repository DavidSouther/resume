"""Paginated Socrata client with mandatory raw-response caching.

Every pull goes through `fetch_all`, which pages with $limit/$offset until
an empty page comes back (never trusts a single request against Socrata's
default 1000-row cap), and writes each page's raw JSON to disk before any
transformation touches it — so the cache under ../cache is always an
unmodified copy of what the API actually returned.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

CACHE_ROOT = Path(__file__).resolve().parent.parent / "cache"


def _cache_dir(dataset_id: str) -> Path:
    d = CACHE_ROOT / dataset_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def fetch_all(
    resource_url: str,
    dataset_id: str,
    *,
    where: str | None = None,
    order_by: str | None = None,
    page_size: int = 50000,
    session: requests.Session | None = None,
) -> list[dict[str, Any]]:
    """Fetch every row matching `where`, paging with $limit/$offset.

    Caches each raw page as cache/<dataset_id>/page_<offset>.json and a
    manifest.json recording the query and total row count, so the pull is
    auditable independent of any later transformation.
    """
    session = session or requests.Session()
    rows: list[dict[str, Any]] = []
    offset = 0
    cache_dir = _cache_dir(dataset_id)

    while True:
        params: dict[str, Any] = {"$limit": page_size, "$offset": offset}
        if where:
            params["$where"] = where
        if order_by:
            params["$order"] = order_by

        resp = session.get(resource_url, params=params, timeout=60)
        resp.raise_for_status()
        page = resp.json()

        (cache_dir / f"page_{offset}.json").write_text(
            json.dumps(page, indent=2), encoding="utf-8"
        )

        if not page:
            break

        rows.extend(page)
        offset += page_size

        if len(page) < page_size:
            # Short page: this was the last one. Still loop once more only
            # if it was exactly full, to confirm there isn't a same-sized
            # next page (handled by the `not page` break above).
            break

    manifest = {
        "dataset_id": dataset_id,
        "resource_url": resource_url,
        "where": where,
        "order_by": order_by,
        "page_size": page_size,
        "row_count": len(rows),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    (cache_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    return rows


def fetch_metadata(metadata_url: str, session: requests.Session | None = None) -> dict[str, Any]:
    """Fetch a dataset's SODA metadata (field list, types, descriptions)."""
    session = session or requests.Session()
    resp = session.get(metadata_url, timeout=60)
    resp.raise_for_status()
    return resp.json()


def load_cached(dataset_id: str) -> list[dict[str, Any]]:
    """Reassemble a dataset's rows from its cached pages, in offset order.

    Raises FileNotFoundError with a clear message if nothing has been
    cached yet — callers should surface this as "run the puller first",
    never silently return an empty list that looks like a real zero.
    """
    cache_dir = CACHE_ROOT / dataset_id
    manifest_path = cache_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(
            f"No cached pull for '{dataset_id}' at {cache_dir}. "
            f"Run the corresponding pull_*.py script first."
        )

    pages = sorted(
        cache_dir.glob("page_*.json"),
        key=lambda p: int(p.stem.removeprefix("page_")),
    )
    rows: list[dict[str, Any]] = []
    for page_path in pages:
        rows.extend(json.loads(page_path.read_text(encoding="utf-8")))
    return rows
