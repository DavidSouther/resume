#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["duckdb>=1.4"]
# ///
"""Feature test: pull 2014 to 2026 results to CSV, then answer the four questions and build the site page.

Run: `uv run pages/election_results/tests/test_feature_election_results.py`.
The first run needs network, and either a Dataverse API token set or the House file already cached.
"""

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from typing import Any

import duckdb

HERE = Path(__file__).resolve().parent.parent

RACE_COLUMNS = {
    "year",
    "state",
    "office",
    "seat",
    "special",
    "round",
    "dem_candidate",
    "dem_votes",
    "dem_pct",
    "gop_candidate",
    "gop_votes",
    "gop_pct",
    "other_votes",
    "total_votes",
    "winner_party",
    "incumbent_name",
    "incumbent_party",
    "incumbent_running",
    "redrawn",
    "official",
    "source_id",
}
CANDIDATE_COLUMNS = {
    "year",
    "state",
    "office",
    "seat",
    "special",
    "round",
    "candidate",
    "party",
    "votes",
    "total_votes",
    "pct",
    "incumbent",
    "official",
}
INCUMBENCY_COLUMNS = {
    "office",
    "lean",
    "incumbent_party",
    "year_scope",
    "regression_bonus",
    "cross_check_bonus",
    "seats",
    "races",
    "wald_diff",
    "wald_se",
    "wald_p",
}
MIN_SEATS = 5
ANSWER_FILES = (
    "seat_change_2026.csv",
    "incumbency_presidential_lean.csv",
    "turnout_k.csv",
    "dummymander.csv",
)


def run(script: str, *args: str) -> None:
    subprocess.run(["uv", "run", script, *args], cwd=HERE, check=True)


class ElectionResultsFeature(unittest.TestCase):
    out: Path
    data: Path
    db: duckdb.DuckDBPyConnection

    @classmethod
    def setUpClass(cls) -> None:
        cls.tmp = tempfile.TemporaryDirectory()
        cls.out = Path(cls.tmp.name) / "out"
        cls.data = Path(cls.tmp.name) / "data"  # only the hand maintained files, copied so the pull never rewrites the committed sources.csv
        (cls.data / "overrides").mkdir(parents=True)
        shutil.copytree(HERE / "data" / "overrides", cls.data / "overrides", dirs_exist_ok=True)
        shutil.copy(HERE / "data" / "sources.csv", cls.data / "sources.csv")
        run("pull.py", "--data", str(cls.data))
        run("analyze.py", "--data", str(cls.data), "--out", str(cls.out))
        run("report.py", "--data", str(cls.data), "--out", str(cls.out))
        cls.db = duckdb.connect()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.db.close()
        cls.tmp.cleanup()

    def csv(self, name: str) -> str:
        path = self.data / name
        self.assertTrue(path.exists(), f"{name} was not written")
        return f"read_csv_auto('{path}')"

    def one(self, sql: str) -> tuple[Any, ...]:
        rows = self.db.sql(sql).fetchall()
        self.assertEqual(len(rows), 1, sql)
        return rows[0]

    def columns(self, name: str) -> set[str]:
        return {c for c in self.db.sql(f"select * from {self.csv(name)} limit 0").columns}

    def test_pull_then_analyze_answers_the_questions(self) -> None:
        races = self.csv("races.csv")

        # The CSVs carry every field the request names, one row per candidate and one per race.
        self.assertLessEqual(RACE_COLUMNS, self.columns("races.csv"))
        self.assertLessEqual(CANDIDATE_COLUMNS, self.columns("candidates.csv"))
        years = {r[0] for r in self.db.sql(f"select distinct year from {races}").fetchall()}
        self.assertLessEqual({2014, 2016, 2018, 2020, 2022, 2024, 2026}, years)
        self.assertEqual(min(years), 2014)
        self.assertEqual(self.one(f"select count(*) from {races} where office = 'house' and year = 2022 and not special")[0], 435)

        # A known result: Texas Senate 2018, Cruz over O'Rourke, incumbent running.
        dem, dem_pct, gop, gop_pct, inc_party, inc_running = self.one(
            f"select dem_candidate, dem_pct, gop_candidate, gop_pct, incumbent_party, incumbent_running from {races} where year = 2018 and state = 'TX' and office = 'senate'"
        )
        self.assertIn("O'ROURKE", dem.upper())
        self.assertIn("CRUZ", gop.upper())
        self.assertAlmostEqual(dem_pct, 48.3, delta=0.1)
        self.assertAlmostEqual(gop_pct, 50.9, delta=0.1)
        self.assertEqual((inc_party, inc_running), ("REP", True))

        # Governors are in the same table: Georgia 2018, Kemp over Abrams for an open seat held by Republicans.
        dem, gop, gop_pct, inc_party, inc_running = self.one(
            f"select dem_candidate, gop_candidate, gop_pct, incumbent_party, incumbent_running from {races} where year = 2018 and state = 'GA' and office = 'governor'"
        )
        self.assertIn("ABRAMS", dem.upper())
        self.assertIn("KEMP", gop.upper())
        self.assertAlmostEqual(gop_pct, 50.2, delta=0.1)
        self.assertEqual((inc_party, inc_running), ("REP", False))

        # Latest round decides: the Georgia runoff and the Maine ranked choice final round.
        dem, dem_pct, gop_pct, round_ = self.one(f"select dem_candidate, dem_pct, gop_pct, round from {races} where year = 2020 and state = 'GA' and office = 'senate' and not special")
        self.assertIn("OSSOFF", dem.upper())
        self.assertGreater(dem_pct, gop_pct)
        self.assertEqual(round_, "runoff")
        dem, dem_pct, gop_pct = self.one(f"select dem_candidate, dem_pct, gop_pct from {races} where year = 2018 and state = 'ME' and office = 'house' and seat = 2")
        self.assertIn("GOLDEN", dem.upper())
        self.assertGreater(dem_pct, gop_pct)

        # Redrawn since the last election: every Texas House seat in 2022, never Wyoming at large.
        self.assertEqual(self.one(f"select bool_and(redrawn) from {races} where year = 2022 and state = 'TX' and office = 'house'")[0], True)
        self.assertEqual(self.one(f"select bool_or(redrawn) from {races} where year = 2022 and state = 'WY'")[0], False)

        # The Senate two year rule: Husted, appointed in 2025, is not the incumbent in the 2026 Ohio special.
        self.assertEqual(
            self.one(f"select incumbent_running, official from {races} where year = 2026 and state = 'OH' and office = 'senate' and special")[0],
            False,
        )
        # official comes from the source's reported status, so only its type is asserted.
        self.assertIn(
            self.one(f"select official from {races} where year = 2026 and state = 'OH' and office = 'senate' and special")[0],
            (True, False),
        )
        self.assertEqual(self.one(f"select count(*) from {races} where official is null")[0], 0)

        # Presidential lean uses the prior presidential election; 5 points or less is swing.
        lean = self.csv("presidential_lean.csv")
        self.assertEqual(self.one(f"select lean from {lean} where state = 'TX' and year = 2022")[0], "red")  # 2020 margin R+5.6
        self.assertEqual(self.one(f"select lean from {lean} where state = 'GA' and year = 2022")[0], "swing")  # 2020 margin D+0.2
        self.assertEqual(self.one(f"select lean from {lean} where state = 'PA' and year = 2026")[0], "swing")  # 2024 margin R+1.7

        # Senate delegation lean counts independents by caucus: Maine going into 2026 is Collins and King.
        delegation = self.csv("senate_delegation.csv")
        self.assertEqual(self.one(f"select lean from {delegation} where state = 'ME' and year(election_date) = 2026")[0], "purple")

        # Question 1: 2026 against the prior seat election; a mid cycle redrawn seat is compared and flagged redrawn.
        change = self.csv("answers/seat_change_2026.csv")
        self.assertEqual(self.one(f"select min(year), max(year) from {change}"), (2026, 2026))
        # Texas redrew mid cycle for 2026, so every 2026 Texas House row is redrawn. A row is comparable exactly when both elections had a Democrat and a Republican.
        self.assertEqual(self.one(f"select bool_and(redrawn) from {change} where state = 'TX' and office = 'house'")[0], True)
        self.assertEqual(
            self.one(
                f"select count(*) from {change} where state = 'TX' and office = 'house' and comparable != "
                "(prior_dem_candidate is not null and prior_gop_candidate is not null and dem_candidate is not null and gop_candidate is not null)"
            )[0],
            0,
        )
        self.assertEqual(self.one(f"select prior_year from {change} where state = 'GA' and office = 'senate' and not special")[0], 2020)

        # Question 2: the incumbency regression by presidential lean, with DEM, REP, and pooled ALL rows.
        for name, groups in (("answers/incumbency_presidential_lean.csv", {"red", "blue", "swing"}),):
            table = self.csv(name)
            self.assertLessEqual(INCUMBENCY_COLUMNS, self.columns(name), name)
            self.assertEqual({r[0] for r in self.db.sql(f"select distinct lean from {table}").fetchall()}, groups, name)
            self.assertEqual({r[0] for r in self.db.sql(f"select distinct incumbent_party from {table}").fetchall()}, {"DEM", "REP", "ALL"}, name)
            scopes = {r[0] for r in self.db.sql(f"select distinct year_scope from {table}").fetchall()}
            self.assertLessEqual({"pooled", "2014", "2016", "2018", "2020", "2022", "2024", "2026"}, scopes, name)
            # Every row carries a seat count, and a bonus is null below the minimum seat count.
            self.assertEqual(self.one(f"select count(*) from {table} where seats is null")[0], 0, name)
            self.assertEqual(self.one(f"select count(*) from {table} where seats < {MIN_SEATS} and regression_bonus is not null")[0], 0, name)
            # The Wald test of beta_D = beta_R is reported wherever both party rows are above the minimum.
            self.assertGreater(self.one(f"select count(*) from {table} where wald_diff is not null and wald_se is not null and wald_p is not null")[0], 0, name)
            self.assertEqual(self.one(f"select count(*) from {table} where wald_p < 0 or wald_p > 1")[0], 0, name)

        # Question 3: k explains the whole shift by turnout alone; Texas Senate 2024 against 2018.
        prior = self.one(f"select dem_votes, gop_votes from {races} where year = 2018 and state = 'TX' and office = 'senate'")
        now = self.one(f"select dem_votes, gop_votes from {races} where year = 2024 and state = 'TX' and office = 'senate'")
        expected_k = (now[0] / prior[0]) / (now[1] / prior[1])
        turnout_k = self.csv("answers/turnout_k.csv")
        self.assertLessEqual({"prior_year", "a", "b", "k", "flip_share"}, self.columns("answers/turnout_k.csv"))
        k, prior_year = self.one(f"select k, prior_year from {turnout_k} where year = 2024 and state = 'TX' and office = 'senate'")
        self.assertEqual(prior_year, 2018)
        self.assertAlmostEqual(k, expected_k, places=4)
        # Texas 2022 is the first election after a census redraw, so it has no k.
        self.assertEqual(self.one(f"select count(*) from {turnout_k} where year = 2022 and state = 'TX' and office = 'house'")[0], 0)

        # Question 4: the dummymander comparison has 2026 rows for both groups.
        dummy = self.csv("answers/dummymander.csv")
        self.assertLessEqual({"year", "office", "group", "mean_change", "difference", "races"}, self.columns("answers/dummymander.csv"))
        self.assertEqual({r[0] for r in self.db.sql(f'select distinct "group" from {dummy} where year = 2026').fetchall()}, {"redrawn", "not_redrawn"})

        # The reporting step writes a site page that references each answer file.
        page = self.out / "report" / "index.html"
        self.assertTrue(page.exists(), "report/index.html was not written")
        html = page.read_text()
        for answer in ANSWER_FILES:
            self.assertIn(answer, html)
        self.assertTrue((self.out / "elections.duckdb").exists())


if __name__ == "__main__":
    unittest.main()
