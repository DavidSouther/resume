import csv
import random
import tempfile
import unittest
from pathlib import Path
from typing import Any

import duckdb

import analyze
from analyze import build_database, fit_incumbency, run_sql_answer, write_incumbency
from lib.source_table import SourceTable

RACE_HEADER: list[str] = [
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
    "paired_incumbents",
    "redrawn",
    "official",
    "source_id",
]
CANDIDATE_HEADER: list[str] = ["year", "state", "office", "seat", "special", "round", "candidate", "party", "votes", "total_votes", "pct", "incumbent", "official", "source_id"]
Race = dict[str, Any]


def race(year: int, state: str, office: str, seat: int, d: int | None, r: int | None, **extra: Any) -> Race:
    """A race row. dem_votes and gop_votes of None mean that party had no candidate. total_votes is d + r + other_votes."""
    other = extra.pop("other_votes", 0)
    total = (d or 0) + (r or 0) + other
    row: Race = {
        "year": year, "state": state, "office": office, "seat": seat, "special": False, "round": "general",
        "dem_candidate": None if d is None else f"Dem {state}{seat} {year}", "dem_votes": d, "dem_pct": None if d is None else 100 * d / total,
        "gop_candidate": None if r is None else f"Rep {state}{seat} {year}", "gop_votes": r, "gop_pct": None if r is None else 100 * r / total,
        "other_votes": other, "total_votes": total, "winner_party": "DEM" if (d or 0) > (r or 0) else "REP",
        "incumbent_name": None, "incumbent_party": None, "incumbent_running": False, "paired_incumbents": False,
        "redrawn": False, "unofficial": False, "source": "test",
    }  # fmt: skip
    row.update(extra)
    return row


def cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def write(path: Path, header: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(header)
        for row in rows:
            writer.writerow([cell(row.get(h)) for h in header])


def candidates_of(races: list[Race]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for r in races:
        for name, party, votes in ((r["dem_candidate"], "DEM", r["dem_votes"]), (r["gop_candidate"], "REP", r["gop_votes"])):
            if votes is not None:
                rows.append({**{k: r[k] for k in ("year", "state", "office", "seat", "special", "round")}, "candidate": name, "party": party, "votes": votes, "incumbent": False, "unofficial": False, "source": r["source"]})
    return rows


class Fixture:
    """A temporary out/ and data/ folder holding the pulled CSVs for a handful of races."""

    def __init__(self, races: list[Race], baseline: list[Race] | None = None, turnout: list[dict[str, Any]] | None = None,
                 redistricting: list[tuple[str, int, str]] | None = None, extra_candidates: list[dict[str, Any]] | None = None,
                 lean: str = "swing", delegation: str = "purple") -> None:  # fmt: skip
        self.tmp = tempfile.TemporaryDirectory()
        self.out = Path(self.tmp.name) / "out"
        self.data = Path(self.tmp.name) / "data"
        self.data.mkdir()
        (self.data / "overrides").mkdir()
        baseline = baseline or []
        table = SourceTable()

        def cited(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
            """Each row with the `source_id` of its `source` text (\"test\" when it has none)."""
            return [{**r, "official": not r.get("unofficial", False), "source_id": table.id_for(r.get("source", "test"), r.get("fetched_at", ""))} for r in rows]

        everything = races + baseline
        states = sorted({r["state"] for r in everything})
        years = sorted({r["year"] for r in everything})
        write(self.data / "races.csv", RACE_HEADER, cited(races))
        write(self.data / "baseline_races.csv", RACE_HEADER, cited(baseline))
        extra = extra_candidates or []
        write(self.data / "candidates.csv", CANDIDATE_HEADER, cited(candidates_of(races) + [c for c in extra if c["year"] >= 2014]))
        write(self.data / "baseline_candidates.csv", CANDIDATE_HEADER, cited(candidates_of(baseline) + [c for c in extra if c["year"] < 2014]))
        write(
            self.data / "presidential_lean.csv",
            ["state", "year", "president_year", "margin", "lean"],
            [{"state": s, "year": y, "president_year": y - 4, "margin": 0, "lean": lean} for s in states for y in years],
        )
        write(
            self.data / "senate_delegation.csv",
            ["state", "year", "election_date", "senator1", "senator1_party", "senator2", "senator2_party", "lean"],
            [{"state": s, "year": y, "election_date": f"{y}-11-03", "lean": delegation} for s in states for y in years],
        )
        write(self.data / "turnout.csv", ["state", "year", "vep", "total_ballots", "official", "source_id"], cited(turnout or []))
        write(
            self.data / "overrides" / "redistricting.csv",
            ["state", "first_election_year", "kind", "source_id"],
            cited([{"state": s, "first_election_year": y, "kind": k, "source": "https://ballotpedia.org/x"} for s, y, k in redistricting or []]),
        )
        table.write(self.data / "sources.csv")
        self.con = build_database(self.out, self.data)

    def answer(self, csv_name: str) -> list[dict[str, Any]]:
        path = self.data / "answers" / csv_name
        run_sql_answer(self.con, analyze.SQL / analyze.ANSWER_SQL[csv_name], path)
        cursor = duckdb.connect().execute(f"select * from read_csv('{path}', header = true)")
        names = [d[0] for d in cursor.description]
        return [dict(zip(names, v, strict=True)) for v in cursor.fetchall()]

    def query(self, sql: str) -> list[dict[str, Any]]:
        cursor = self.con.execute(sql)
        names = [d[0] for d in cursor.description]
        return [dict(zip(names, v, strict=True)) for v in cursor.fetchall()]

    def close(self) -> None:
        self.con.close()
        self.tmp.cleanup()


def fixture(test: unittest.TestCase, races: list[Race], **kwargs: Any) -> Fixture:
    f = Fixture(races, **kwargs)
    test.addCleanup(f.close)
    return f


def only(rows: list[dict[str, Any]], **match: Any) -> dict[str, Any]:
    found = [r for r in rows if all(r[k] == v for k, v in match.items())]
    assert len(found) == 1, f"{len(found)} rows match {match}"
    return found[0]


class TurnoutKTests(unittest.TestCase):
    def test_k_matches_hand_computation(self) -> None:
        f = fixture(self, [race(2018, "TX", "senate", 1, 100, 200), race(2024, "TX", "senate", 1, 150, 250), race(2018, "NM", "senate", 1, 300, 100), race(2024, "NM", "senate", 1, 200, 200)])
        rows = f.answer("turnout_k.csv")
        tx = only(rows, state="TX")
        self.assertEqual(tx["prior_year"], 2018)
        self.assertAlmostEqual(tx["a"], 1.5)
        self.assertAlmostEqual(tx["b"], 1.25)
        self.assertAlmostEqual(tx["k"], 1.2)
        self.assertAlmostEqual(tx["flip_share"], 150 / 400 - 100 / 300)
        nm = only(rows, state="NM")
        self.assertAlmostEqual(nm["k"], (2 / 3) / 2)
        self.assertAlmostEqual(nm["flip_share"], -0.25)
        self.assertAlmostEqual(nm["k_effective"], nm["k"])

    def test_first_election_after_census_redraw_has_no_k_and_is_not_comparable(self) -> None:
        races = [race(2024, "XX", "house", 1, 100, 100), race(2026, "XX", "house", 1, 120, 100, redrawn=True)]
        f = fixture(self, races, redistricting=[("XX", 2026, "census")])
        self.assertEqual([r for r in f.answer("turnout_k.csv") if r["year"] == 2026], [])
        row = only(f.answer("seat_change_2026.csv"), state="XX")
        self.assertEqual((row["comparable"], row["redrawn"], row["prior_year"]), (False, True, 2024))

    def test_mid_cycle_redrawn_seat_is_comparable_and_redrawn(self) -> None:
        races = [race(2024, "TX", "house", 9, 100, 100), race(2026, "TX", "house", 9, 120, 100, redrawn=True)]
        f = fixture(self, races, redistricting=[("TX", 2022, "census"), ("TX", 2026, "mid_cycle")])
        row = only(f.answer("seat_change_2026.csv"), state="TX")
        self.assertEqual((row["comparable"], row["redrawn"]), (True, True))
        self.assertEqual(len([r for r in f.answer("turnout_k.csv") if r["year"] == 2026]), 1)

    def test_special_is_the_prior_and_a_same_year_regular_wins_over_a_special(self) -> None:
        races = [
            race(2020, "GA", "senate", 3, 100, 100, special=True),
            race(2022, "GA", "senate", 3, 110, 100),
            race(2026, "GA", "senate", 3, 120, 100),
            race(2024, "GA", "senate", 2, 100, 100, special=True),
            race(2024, "GA", "senate", 2, 90, 100),
            race(2026, "GA", "senate", 2, 95, 100, special=True),
        ]
        f = fixture(self, races)
        rows = f.query("select year, seat, special, prior_year, prior_special from seat_prior where year >= 2022")
        self.assertEqual(only(rows, year=2022, seat=3)["prior_special"], True)
        later = only(rows, year=2026, seat=2)
        self.assertEqual((later["prior_year"], later["prior_special"]), (2024, False))

    def test_race_lacking_a_party_is_kept_in_seat_change_and_left_out_of_turnout_k(self) -> None:
        races = [race(2020, "AL", "senate", 2, 100, 200), race(2026, "AL", "senate", 2, None, 300), race(2020, "AR", "senate", 2, 0, 200, dem_candidate="Zero"), race(2026, "AR", "senate", 2, 50, 200)]
        f = fixture(self, races)
        self.assertEqual(only(f.answer("seat_change_2026.csv"), state="AL")["comparable"], False)
        self.assertEqual(only(f.answer("seat_change_2026.csv"), state="AR")["comparable"], False)
        self.assertEqual(f.answer("turnout_k.csv"), [])

    def test_seat_change_reports_share_and_margin_changes(self) -> None:
        races = [
            race(2020, "GA", "senate", 2, 100, 100, dem_candidate="JON OSSOFF", gop_candidate="DAVID A. PERDUE, JR."),
            race(2026, "GA", "senate", 2, 120, 80, other_votes=200, dem_candidate="Raphael Warnock", gop_candidate="David Perdue"),
        ]
        rows = fixture(self, races).answer("seat_change_2026.csv")
        row = only(rows, state="GA")
        self.assertEqual(row["prior_year"], 2020)
        self.assertAlmostEqual(row["dem_pct_change"], 30 - 50)
        self.assertAlmostEqual(row["margin_change"], 20 - 0)
        self.assertEqual((row["same_dem_candidate"], row["same_gop_candidate"]), (False, True))


class PlausibilityTests(unittest.TestCase):
    def plausible(self, d1: int, r1: int, **current: Any) -> dict[str, Any]:
        races = [race(2022, "PA", "senate", 3, 400_000, 400_000), race(2028, "PA", "senate", 3, d1, r1, **current)]
        return only(fixture(self, races).answer("turnout_k.csv"), year=2028)

    def test_positive_requirement_against_a_small_and_a_large_ballot_change(self) -> None:
        small = self.plausible(442_750, 362_250)  # s1 = 0.55 on 805,000 votes
        self.assertAlmostEqual(small["required_extra_dem_votes"], 400_000 * 0.55 / 0.45 - 400_000, places=3)
        self.assertEqual(small["actual_total_votes_change"], 5_000)
        self.assertAlmostEqual(small["slack"], 16_000)
        self.assertEqual(small["turnout_plausible"], False)
        self.assertEqual(self.plausible(506_000, 414_000)["turnout_plausible"], True)  # 120,000 more votes

    def test_negative_requirement_against_a_decline_and_an_increase(self) -> None:
        decline = self.plausible(319_500, 390_500)  # s1 = 0.45 on 710,000 votes
        self.assertAlmostEqual(decline["required_extra_dem_votes"], 400_000 * 0.45 / 0.55 - 400_000, places=3)
        self.assertEqual(decline["turnout_plausible"], True)
        self.assertEqual(self.plausible(400_500, 489_500)["turnout_plausible"], False)  # 90,000 more votes

    def test_redrawn_race_uses_the_scaled_statewide_change_and_a_missing_year_is_null(self) -> None:
        races = [
            race(2024, "NC", "house", 1, 400_000, 400_000), race(2026, "NC", "house", 1, 420_000, 380_000, redrawn=True),
            race(2024, "OH", "house", 1, 400_000, 400_000), race(2026, "OH", "house", 1, 420_000, 380_000, redrawn=True),
            race(2024, "VT", "house", 0, 400_000, 400_000), race(2026, "VT", "house", 0, 420_000, 380_000),
        ]  # fmt: skip
        turnout = [
            {"state": "NC", "year": 2024, "vep": 4_000_000, "total_ballots": 2_000_000},
            {"state": "NC", "year": 2026, "vep": 4_200_000, "total_ballots": 2_100_000},
            {"state": "OH", "year": 2024, "vep": 4_000_000, "total_ballots": 2_000_000},
        ]
        rows = fixture(self, races, turnout=turnout, redistricting=[("NC", 2026, "mid_cycle"), ("OH", 2026, "mid_cycle")]).answer("turnout_k.csv")
        nc = only(rows, state="NC")
        self.assertEqual(nc["actual_statewide_ballots_change"], 100_000)
        self.assertAlmostEqual(nc["actual_statewide_vep_turnout_change"], 0.0)
        self.assertAlmostEqual(nc["comparison_change"], 100_000 * 800_000 / 2_000_000)
        oh = only(rows, state="OH")
        self.assertIsNone(oh["actual_statewide_ballots_change"])
        self.assertIsNone(oh["comparison_change"])
        self.assertIsNone(oh["turnout_plausible"])
        vt = only(rows, state="VT")
        self.assertIsNone(vt["actual_statewide_ballots_change"])
        self.assertEqual(vt["comparison_change"], 0)
        self.assertIsNotNone(vt["turnout_plausible"])


class SqlByHandTests(unittest.TestCase):
    def test_answer_files_match_their_sql_run_by_hand(self) -> None:
        f = fixture(self, [race(2020, "GA", "senate", 2, 100, 100), race(2026, "GA", "senate", 2, 120, 80)])
        for name in ("seat_change_2026.csv", "turnout_k.csv"):
            answer = f.answer(name)
            by_hand = f.query((analyze.SQL / analyze.ANSWER_SQL[name]).read_text())
            self.assertEqual(len(answer), len(by_hand), name)
            for written, live in zip(answer, by_hand, strict=True):
                for key, value in live.items():
                    if isinstance(value, float):
                        self.assertAlmostEqual(written[key], value, places=9, msg=f"{name} {key}")
                    else:
                        self.assertEqual(written[key], value, f"{name} {key}")


def synthetic_rows(beta_d: float, beta_r: float, seats: int, seed: int, years: tuple[int, ...] = (2018, 2020), noise: float = 1.0) -> list[dict[str, Any]]:
    """seats Democratic incumbents, seats Republican incumbents, and seats open races, with bonuses planted in each party's sign."""
    rng = random.Random(seed)
    rows: list[dict[str, Any]] = []
    for kind in ("DEM", "REP", "open"):
        for i in range(seats):
            year = years[i % len(years)]
            prior = rng.uniform(30, 70)
            winner = prior > 50
            party = kind if kind != "open" else ("DEM" if winner else "REP")
            share = 5 + 0.85 * prior + 2 * winner + (year - 2018) * 0.3 + (beta_d if kind == "DEM" else -beta_r if kind == "REP" else 0) + rng.gauss(0, noise)
            rows.append({"year": year, "dem_share": share, "prior_dem_share": prior, "prior_winner_dem": winner, "inc_dem": kind == "DEM", "inc_rep": kind == "REP", "incumbent_party": party})
    return rows


class FitIncumbencyTests(unittest.TestCase):
    def test_fit_recovers_planted_bonus(self) -> None:
        out = {r["incumbent_party"]: r for r in fit_incumbency(synthetic_rows(beta_d=2.0, beta_r=5.0, seats=200, seed=1))}
        self.assertAlmostEqual(out["DEM"]["regression_bonus"], 2.0, delta=0.5)
        self.assertAlmostEqual(out["REP"]["regression_bonus"], 5.0, delta=0.5)
        self.assertAlmostEqual(out["DEM"]["wald_diff"], out["DEM"]["regression_bonus"] - out["REP"]["regression_bonus"])
        self.assertLess(out["DEM"]["wald_p"], 0.001)
        self.assertEqual(out["DEM"]["wald_p"], out["REP"]["wald_p"])
        self.assertEqual(out["REP"]["wald_p"], out["ALL"]["wald_p"])
        self.assertEqual((out["DEM"]["seats"], out["REP"]["seats"], out["ALL"]["seats"], out["ALL"]["races"]), (200, 200, 400, 600))
        self.assertAlmostEqual(out["ALL"]["regression_bonus"], 3.5, delta=0.5)

    def test_equal_bonuses_give_a_large_p(self) -> None:
        out = fit_incumbency(synthetic_rows(beta_d=3.0, beta_r=3.0, seats=200, seed=2))
        self.assertGreater(out[0]["wald_p"], 0.05)
        self.assertLessEqual(out[0]["wald_p"], 1.0)

    def test_noise_free_rows_give_exact_bonuses(self) -> None:
        out = {r["incumbent_party"]: r for r in fit_incumbency(synthetic_rows(beta_d=1.5, beta_r=-2.0, seats=10, seed=3, noise=0.0))}
        self.assertAlmostEqual(out["DEM"]["regression_bonus"], 1.5, places=6)
        self.assertAlmostEqual(out["REP"]["regression_bonus"], -2.0, places=6)  # a planted Republican disadvantage is negative on the REP row

    def test_republican_advantage_is_positive_on_the_rep_row(self) -> None:
        out = {r["incumbent_party"]: r for r in fit_incumbency(synthetic_rows(beta_d=0.0, beta_r=6.0, seats=50, seed=4))}
        self.assertGreater(out["REP"]["regression_bonus"], 4.0)
        self.assertGreater(out["REP"]["cross_check_bonus"], 4.0)

    def test_four_seats_is_null_and_five_seats_reports(self) -> None:
        rows = synthetic_rows(beta_d=2.0, beta_r=2.0, seats=40, seed=5)
        dems = [r for r in rows if r["inc_dem"]]
        rest = [r for r in rows if not r["inc_dem"]]
        four = {r["incumbent_party"]: r for r in fit_incumbency(rest + dems[:4])}
        self.assertEqual(four["DEM"]["seats"], 4)
        self.assertIsNone(four["DEM"]["regression_bonus"])
        self.assertIsNone(four["DEM"]["cross_check_bonus"])
        self.assertIsNotNone(four["REP"]["regression_bonus"])
        for row in four.values():
            self.assertIsNone(row["wald_diff"])
            self.assertIsNone(row["wald_se"])
            self.assertIsNone(row["wald_p"])
        five = {r["incumbent_party"]: r for r in fit_incumbency(rest + dems[:5])}
        self.assertIsNotNone(five["DEM"]["regression_bonus"])
        self.assertIsNotNone(five["DEM"]["wald_p"])

    def test_open_seats_only_write_rows_with_zero_seats(self) -> None:
        rows = [r for r in synthetic_rows(beta_d=0, beta_r=0, seats=20, seed=6) if not r["inc_dem"] and not r["inc_rep"]]
        out = fit_incumbency(rows)
        self.assertEqual([r["incumbent_party"] for r in out], ["DEM", "REP", "ALL"])
        self.assertEqual([(r["seats"], r["races"], r["regression_bonus"]) for r in out], [(0, 20, None)] * 3)
        self.assertEqual(fit_incumbency([])[2]["races"], 0)

    def test_cross_check_is_a_difference_of_means(self) -> None:
        def row(share: float, prior: float, party: str, running: bool) -> dict[str, Any]:
            return {
                "year": 2018,
                "dem_share": share,
                "prior_dem_share": prior,
                "prior_winner_dem": prior > 50,
                "inc_dem": running and party == "DEM",
                "inc_rep": running and party == "REP",
                "incumbent_party": party,
            }

        rows = [row(55 + i % 3, 52, "DEM", True) for i in range(5)] + [row(50, 52, "DEM", False), row(48, 52, "DEM", False)]
        rows += [row(40, 45, "REP", True) for _ in range(5)] + [row(47, 45, "REP", False)]
        out = {r["incumbent_party"]: r for r in fit_incumbency(rows)}
        dem_running = sum(55 + i % 3 - 52 for i in range(5)) / 5  # 4.0
        self.assertAlmostEqual(out["DEM"]["cross_check_bonus"], dem_running - (-2 + -4) / 2)  # 7.0
        self.assertAlmostEqual(out["REP"]["cross_check_bonus"], 5 - (-2))  # 7.0
        self.assertAlmostEqual(out["ALL"]["cross_check_bonus"], (dem_running * 5 + 5 * 5) / 10 - (-2 - 4 - 2) / 3)

    def test_numpy_fit_agrees_with_statsmodels(self) -> None:
        try:
            import statsmodels.api as sm  # pyright: ignore[reportMissingTypeStubs]
        except ImportError:
            self.skipTest("statsmodels is not installed")
        rows = synthetic_rows(beta_d=2.0, beta_r=4.0, seats=60, seed=7, years=(2018, 2020, 2022))
        x = [[1.0, r["prior_dem_share"], float(r["prior_winner_dem"]), float(r["year"] == 2020), float(r["year"] == 2022), float(r["inc_dem"]), float(r["inc_rep"])] for r in rows]
        fit: Any = sm.OLS([r["dem_share"] for r in rows], x).fit()  # pyright: ignore[reportUnknownMemberType]
        ours = {r["incumbent_party"]: r for r in fit_incumbency(rows)}
        self.assertAlmostEqual(ours["DEM"]["regression_bonus"], fit.params[5], places=8)
        self.assertAlmostEqual(ours["REP"]["regression_bonus"], -fit.params[6], places=8)
        test: Any = fit.t_test([0, 0, 0, 0, 0, 1, 1])  # beta_D + beta_R = 0, which is equal bonuses in each party's sign
        self.assertAlmostEqual(ours["DEM"]["wald_se"], float(test.sd.item()), places=8)


class IncumbencyInputTests(unittest.TestCase):
    def test_population_drops_paired_and_non_comparable_races_and_keeps_mid_cycle_seats(self) -> None:
        races = [
            race(2024, "TX", "house", 1, 100, 200), race(2026, "TX", "house", 1, 110, 190, redrawn=True, incumbent_party="REP", incumbent_running=True),
            race(2024, "TX", "house", 2, 100, 200), race(2026, "TX", "house", 2, 110, 190, redrawn=True, paired_incumbents=True, incumbent_running=True, incumbent_party="REP"),
            race(2024, "OK", "house", 1, None, 200), race(2026, "OK", "house", 1, 110, 190, incumbent_party="REP", incumbent_running=True),
        ]  # fmt: skip
        f = fixture(self, races, redistricting=[("TX", 2026, "mid_cycle")])
        rows = f.query("select state, seat, inc_rep, mid_cycle from incumbency_input")
        self.assertEqual(rows, [{"state": "TX", "seat": 1, "inc_rep": True, "mid_cycle": True}])

    def test_caucusing_independent_stands_in_for_their_party(self) -> None:
        base = {"year": 2018, "state": "ME", "office": "senate", "seat": 1, "special": False, "round": "general", "unofficial": False}
        races = [
            race(2018, "ME", "senate", 1, 100, 300, incumbent_name="ANGUS S. KING, JR.", incumbent_party="DEM", incumbent_running=True, other_votes=600),
        ]
        baseline = [race(2012, "ME", "senate", 1, 130, 310, other_votes=530)]
        extra = [
            {**base, "candidate": "ANGUS S. KING, JR.", "party": "OTHER", "votes": 600, "incumbent": True},
            {**base, "year": 2012, "candidate": "ANGUS KING", "party": "OTHER", "votes": 530, "incumbent": False},
        ]
        f = fixture(self, races, baseline=baseline, extra_candidates=extra)
        row = only(f.query("select * from incumbency_input"), state="ME")
        self.assertEqual((row["inc_dem"], row["inc_rep"]), (True, False))
        self.assertAlmostEqual(row["dem_share"], 100 * 600 / 900)
        self.assertAlmostEqual(row["prior_dem_share"], 100 * 530 / 840)
        self.assertEqual(row["prior_winner_dem"], True)

    def test_write_incumbency_writes_every_group_and_scope(self) -> None:
        races = [race(2022, "GA", "senate", 2, 100, 100), race(2026, "GA", "senate", 2, 120, 80, incumbent_party="DEM", incumbent_running=True)]
        f = fixture(self, races)
        write_incumbency(f.con, f.data)
        with (f.data / "answers" / "incumbency_presidential_lean.csv").open() as handle:
            rows = list(csv.DictReader(handle))
        self.assertEqual({r["lean"] for r in rows}, {"red", "blue", "swing"})
        self.assertEqual(len(rows), 3 * 3 * 3 * 8)  # offices, lean groups, parties, pooled plus 2014 to 2026
        swing = only([dict(r) for r in rows], office="senate", lean="swing", incumbent_party="DEM", year_scope="2026")
        self.assertEqual((swing["seats"], swing["races"], swing["regression_bonus"]), ("1", "1", ""))
        self.assertFalse((f.data / "answers" / "incumbency_senate_delegation.csv").exists())


class DummymanderTests(unittest.TestCase):
    def test_rows_only_for_years_with_mid_cycle_states(self) -> None:
        def pair(state: str, year: int, prior: tuple[int, int], now: tuple[int, int], party: str, redrawn: bool = False) -> list[Race]:
            return [race(year - 2, state, "house", 1, *prior), race(year, state, "house", 1, *now, incumbent_party=party, incumbent_running=True, redrawn=redrawn)]

        races = [
            *pair("PA", 2018, (50, 50), (40, 60), "REP", redrawn=True),  # REP share 50 to 60: +10
            *pair("OH", 2018, (50, 50), (55, 45), "REP"),  # REP share 50 to 45: -5
            *pair("FL", 2016, (40, 60), (45, 55), "DEM", redrawn=True),  # DEM share 40 to 45: +5
            *pair("GA", 2016, (60, 40), (55, 45), "DEM"),  # DEM share 60 to 55: -5
            *pair("IA", 2014, (50, 50), (60, 40), "DEM"),
        ]
        f = fixture(self, races, redistricting=[("PA", 2018, "mid_cycle"), ("FL", 2016, "mid_cycle"), ("PA", 2012, "census")])
        rows = f.answer("dummymander.csv")
        self.assertEqual({r["year"] for r in rows}, {2016, 2018})
        pa = only(rows, year=2018, group="redrawn")
        self.assertAlmostEqual(pa["mean_change"], 10.0)
        self.assertEqual(pa["races"], 1)
        self.assertAlmostEqual(only(rows, year=2018, group="not_redrawn")["mean_change"], -5.0)
        self.assertAlmostEqual(pa["difference"], 15.0)
        self.assertAlmostEqual(only(rows, year=2018, group="not_redrawn")["difference"], 15.0)
        self.assertAlmostEqual(only(rows, year=2016, group="redrawn")["difference"], 10.0)

    def test_a_group_without_races_still_has_a_row(self) -> None:
        races = [
            race(2024, "TX", "house", 9, 50, 50),
            race(2026, "TX", "house", 9, 60, 40, redrawn=True),
            race(2024, "KY", "house", 1, 40, 60),
            race(2026, "KY", "house", 1, 45, 55, incumbent_party="REP", incumbent_running=True),
        ]
        rows = fixture(self, races, redistricting=[("TX", 2026, "mid_cycle")]).answer("dummymander.csv")
        self.assertEqual(only(rows, year=2026, group="redrawn")["races"], 0)
        self.assertIsNone(only(rows, year=2026, group="redrawn")["difference"])
        self.assertAlmostEqual(only(rows, year=2026, group="not_redrawn")["mean_change"], -5.0)


if __name__ == "__main__":
    unittest.main()
