import tempfile
import unittest
from pathlib import Path

import report
from report import ANSWER_FILES, render_page

SEAT = {
    "year": "2026",
    "state": "TX",
    "office": "house",
    "seat": "9",
    "dem_candidate": "A <b> & Co",
    "gop_candidate": "",
    "dem_pct": "60",
    "gop_pct": "",
    "margin_change": "2.5",
    "comparable": "true",
    "redrawn": "true",
}
INC = {
    "office": "house",
    "lean": "red",
    "year_scope": "pooled",
    "incumbent_party": "DEM",
    "regression_bonus": "2.0",
    "cross_check_bonus": "1.5",
    "seats": "10",
    "races": "20",
    "wald_diff": "0.5",
    "wald_se": "1",
    "wald_p": "0.6",
}
TURN = {
    "year": "2026",
    "state": "TX",
    "office": "house",
    "seat": "9",
    "k": "1.1",
    "flip_share": "0.02",
    "required_extra_dem_votes": "100",
    "comparison_change": "50",
    "slack": "10",
    "turnout_plausible": "false",
}


def fixture_answers() -> dict[str, list[dict[str, str]]]:
    return {
        "seat_change_2026.csv": [SEAT],
        "incumbency_presidential_lean.csv": [INC, {**INC, "year_scope": "2024"}],
        "turnout_k.csv": [TURN],
        "dummymander.csv": [],
        "dummymander_party.csv": [],
        "dummymander_test.csv": [],
    }


class ReportTest(unittest.TestCase):
    def test_page_references_each_answer_file_by_relative_path(self) -> None:
        html = render_page(fixture_answers())
        for name in ANSWER_FILES:
            self.assertIn(f'href="../../data/answers/{name}"', html)

    def test_page_states_2026_is_unofficial(self) -> None:
        self.assertIn("unofficial", render_page(fixture_answers(), "2026-11-05"))
        self.assertIn("2026-11-05", render_page(fixture_answers(), "2026-11-05"))

    def test_empty_dummymander_says_no_mid_cycle_states(self) -> None:
        self.assertIn("No mid cycle states", render_page(fixture_answers()))

    def test_values_are_escaped(self) -> None:
        html = render_page(fixture_answers())
        self.assertIn("A &lt;b&gt; &amp; Co", html)
        self.assertNotIn("A <b>", html)

    def test_long_tables_are_capped(self) -> None:
        answers = fixture_answers()
        answers["turnout_k.csv"] = [TURN] * 60
        html = render_page(answers)
        self.assertIn("Showing the first 25 of 60 rows", html)

    def test_summaries_are_computed_from_data(self) -> None:
        html = render_page(fixture_answers())
        self.assertIn("1 are comparable", html)
        self.assertIn("implausible for 1", html)

    def test_main_writes_only_under_out(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out, data = Path(tmp) / "out", Path(tmp) / "data"
            (data / "answers").mkdir(parents=True)
            for name, rows in fixture_answers().items():
                header = list(rows[0]) if rows else ["year", "office", "group", "mean_change", "difference", "races"]
                lines = [",".join(header)] + [",".join('"' + r[c].replace('"', '""') + '"' for c in header) for r in rows]
                (data / "answers" / name).write_text("\n".join(lines) + "\n")
            before = {p for p in Path(tmp).rglob("*")}
            self.assertEqual(report.main(["--data", str(data), "--out", str(out)]), 0)
            created = {p for p in Path(tmp).rglob("*")} - before
            self.assertEqual({p for p in created if out not in p.parents and p != out}, set())
            self.assertTrue((out / "report" / "index.html").exists())


if __name__ == "__main__":
    unittest.main()
