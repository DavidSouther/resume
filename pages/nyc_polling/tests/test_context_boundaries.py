"""Feature test: each domain folder imports only from its own layer or lower. Layers follow docs/ddd/domain-model.md."""

import ast
import unittest
from pathlib import Path

PACKAGE = Path(__file__).resolve().parent.parent / "nyc_tracts"

GENERIC, KERNEL, SUPPORTING, CORE, PRESENTATION = range(5)
LAYER = {
    "generic": GENERIC,
    "kernel": KERNEL,
    "geography": SUPPORTING,
    "poll_site_registry": SUPPORTING,
    "assembly": SUPPORTING,
    "disparity_hypotheses": CORE,
    "presentation": PRESENTATION,
}
# Generic statistics return result types that live in the disparity_hypotheses results module.
KNOWN_DEBT = {("generic", "disparity_hypotheses")}


def domains_imported(domain: str) -> set[str]:
    out: set[str] = set()
    for path in (PACKAGE / domain).glob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.ImportFrom) and node.level == 2:
                out |= {node.module.split(".")[0]} if node.module else {a.name for a in node.names}
    return out & LAYER.keys()


class ContextBoundaries(unittest.TestCase):
    def test_every_folder_is_a_classified_domain(self) -> None:
        folders = {p.name for p in PACKAGE.iterdir() if p.is_dir() and p.name != "__pycache__"}
        self.assertEqual(folders, LAYER.keys())
        self.assertEqual([p.name for p in PACKAGE.glob("*.py") if p.name != "__init__.py"], [])

    def test_imports_point_at_own_layer_or_lower(self) -> None:
        upward = {(d, i) for d in LAYER for i in domains_imported(d) if LAYER[i] > LAYER[d]}
        self.assertEqual(upward, KNOWN_DEBT)
