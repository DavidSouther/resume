import json
import unittest
from pathlib import Path

from lib import findings_format as fmt
from lib.findings_rules import (
    DISPLAY,
    FAMILIES,
    SPARSE_DISPLAY,
    SPARSE_VALUES,
    THRESHOLDS,
    Claim,
    Counts2026,
    Group,
    Row,
    bonus_vs_history,
    completeness,
    dummymander,
    dummymander_party,
    dummymander_test,
    dummymander_vs_history,
    incumbency_party_gap,
    k_direction,
    party_flips,
    party_flips_by_lean,
    race_key,
    rule_text,
    seat_shift,
    seat_shift_by_lean,
    selector_keys,
    significance,
    turnout_explanation,
)

SCHEMA = json.loads((Path(__file__).parent.parent / "findings.schema.json").read_text())
GROUP = Group("presidential", "house", "red")


def seat(margin_change: float | None, prior: float | None = 1.0, state: str = "TX", seat_no: int = 1, comparable: bool = True, office: str = "house") -> Row:
    margin = None if prior is None or margin_change is None else prior + margin_change
    return {
        "year": "2026",
        "state": state,
        "office": office,
        "seat": str(seat_no),
        "special": "false",
        "prior_margin": "" if prior is None else str(prior),
        "margin": "" if margin is None else str(margin),
        "margin_change": "" if margin_change is None else str(margin_change),
        "comparable": "true" if comparable else "false",
    }


def seats(*changes: float | None) -> list[Row]:
    return [seat(c, seat_no=i + 1) for i, c in enumerate(changes)]


def leaned(*changes: float | None, lean: str = "red") -> list[Row]:
    return [{**r, "presidential_lean": lean} for r in seats(*changes)]


def fit(year: str, dem: float | None, rep: float | None, p: float | None, diff: float | None = 1.0, dem_seats: int = 10, rep_seats: int = 10) -> list[Row]:
    def row(party: str, bonus: float | None, n: int) -> Row:
        return {
            "office": GROUP.office,
            "lean": GROUP.lean,
            "year_scope": year,
            "incumbent_party": party,
            "regression_bonus": "" if bonus is None else str(bonus),
            "seats": str(n),
            "wald_diff": "" if p is None or diff is None else str(diff),
            "wald_p": "" if p is None else str(p),
        }

    return [row("DEM", dem, dem_seats), row("REP", rep, rep_seats), row("ALL", None, dem_seats + rep_seats)]


def turnout(*plausible: str, ks: list[float] | None = None) -> list[Row]:
    rows: list[Row] = []
    for i, p in enumerate(plausible):
        k = "" if ks is None else str(ks[i])
        rows.append({"year": "2026", "state": "OH", "office": "house", "seat": str(i + 1), "special": "false", "k": k, "turnout_plausible": p})
    return rows


def dummy(diffs: dict[int, float | None], redrawn_races: int = 10, not_redrawn_races: int = 100) -> list[Row]:
    rows: list[Row] = []
    for year, diff in diffs.items():
        mean = "" if diff is None else str(diff)
        d = "" if diff is None else str(diff)
        rows.append({"year": str(year), "office": "house", "group": "redrawn", "mean_change": mean, "difference": d, "races": str(redrawn_races)})
        rows.append({"year": str(year), "office": "house", "group": "not_redrawn", "mean_change": "" if diff is None else "0.0", "difference": d, "races": str(not_redrawn_races)})
    return rows


def counts(races: int = 10, ap: int = 10, unofficial: int = 10, below_95: int = 0, unknown: int = 0) -> dict[str, Counts2026]:
    one: Counts2026 = {
        "races": races,
        "ap_races": ap,
        "unofficial": unofficial,
        "certified": races - unofficial,
        "eevp_below_100": below_95,
        "eevp_below_95": below_95,
        "eevp_unknown": unknown,
        "eevp_min": 80.0 if below_95 else 99.0,
        "eevp_median": 99.0,
        "latest_update": "2026-11-05T15:28:06Z",
    }
    return {"house": one, "senate": one.copy(), "governor": one.copy()}


class SelectorKeysTest(unittest.TestCase):
    def test_seventy_two_unique_keys(self) -> None:
        keys = selector_keys()

        self.assertEqual(len(keys), 72)
        self.assertEqual(len(set(keys)), 72)
        self.assertIn("bonus_vs_history.presidential.governor.swing.REP", keys)
        self.assertIn("seat_shift_by_lean.senate.swing", keys)
        self.assertFalse(any("senate_delegation" in k for k in keys))
        self.assertEqual(keys[0], "completeness")

    def test_schema_enums_match_the_families_in_order(self) -> None:
        for family, values in FAMILIES.items():
            self.assertEqual(SCHEMA["$defs"][family]["enum"], list(values), family)

    def test_rule_text_covers_every_family(self) -> None:
        text = rule_text()

        self.assertEqual(set(text), set(FAMILIES))
        self.assertIn("5", text["seat_shift"][0])

    def test_race_key_marks_specials(self) -> None:
        self.assertEqual(race_key({"year": "2026", "state": "OH", "office": "senate", "seat": "3", "special": "true"}), "2026:OH:senate:3:special")
        self.assertEqual(race_key({"year": "2026", "state": "TX", "office": "house", "seat": "26", "special": "false"}), "2026:TX:house:26")


class CompletenessTest(unittest.TestCase):
    def test_no_ap_rows(self) -> None:
        self.assertEqual(completeness(counts(ap=0), None)["value"], "no_2026_data")

    def test_all_certified(self) -> None:
        self.assertEqual(completeness(counts(unofficial=0, below_95=2), "t")["value"], "certified")

    def test_nearly_complete(self) -> None:
        claim = completeness(counts(), "2026-11-06T03:51:02Z")

        self.assertEqual(claim["value"], "counting_nearly_complete")
        self.assertEqual(claim["display"]["races_2026"], "30")
        self.assertEqual(claim["display"]["fetched_at"], "2026-11-06T03:51:02Z")

    def test_in_progress_when_below_95_or_unknown(self) -> None:
        self.assertEqual(completeness(counts(below_95=1), "t")["value"], "counting_in_progress")
        self.assertEqual(completeness(counts(unknown=1), "t")["value"], "counting_in_progress")


class SeatShiftTest(unittest.TestCase):
    def test_toward_dem(self) -> None:
        rows = seats(2.0, 2.0, 2.0, 2.0, 2.0)

        claim = seat_shift(rows, "house")

        self.assertEqual(claim["value"], "toward_dem")
        self.assertEqual(claim["numbers"]["n"], 5)

    def test_boundaries_are_inclusive(self) -> None:
        self.assertEqual(seat_shift(seats(1.0, 1.0, 1.0, 0.0, 5.0), "house")["value"], "toward_dem")
        self.assertEqual(seat_shift(seats(-1.0, -1.0, -1.0, 0.0, -5.0), "house")["value"], "toward_rep")
        self.assertEqual(seat_shift(seats(0.99, 0.99, 0.99, 0.0, 5.0), "house")["value"], "no_clear_shift")

    def test_four_races_is_insufficient(self) -> None:
        claim = seat_shift(seats(2.0, 2.0, 2.0, 2.0), "house")

        self.assertEqual(claim["value"], "insufficient_data")
        self.assertEqual(claim["trigger_fields"], ["n"])
        self.assertEqual(claim["display"], {"n": "4"})

    def test_skips_incomparable_races_and_other_offices(self) -> None:
        rows = [*seats(2.0, 2.0, 2.0, 2.0), seat(2.0, comparable=False), seat(2.0, office="senate"), seat(None)]

        self.assertEqual(seat_shift(rows, "house")["numbers"]["n"], 4)

    def test_display_strings(self) -> None:
        claim = seat_shift(seats(1.234, 1.234, 1.234, -3.0, 5.0), "house")

        self.assertEqual(claim["display"]["median_margin_change"], "+1.23 points")
        self.assertEqual(claim["display"]["share_toward_dem"], "80.0 percent")
        self.assertEqual(claim["trigger_fields"], ["n", "median_margin_change", "share_toward_dem"])
        self.assertAlmostEqual(claim["numbers"]["median_margin_change"] or 0, 1.234)
        self.assertIn("2026:TX:house:1", claim["evidence"])

    def test_negative_uses_minus_sign(self) -> None:
        claim = seat_shift(seats(-2.5, -2.5, -2.5, -2.5, -2.5), "house")

        self.assertEqual(claim["display"]["median_margin_change"], f"{fmt.MINUS}2.50 points")

    def test_display_clears_the_cut_point(self) -> None:
        claim = seat_shift(seats(0.999, 0.999, 0.999, 0.999, 0.999), "house")

        self.assertEqual(claim["value"], "no_clear_shift")
        self.assertEqual(claim["display"]["median_margin_change"], "+0.999 points")


class PartyFlipsTest(unittest.TestCase):
    def test_none(self) -> None:
        self.assertEqual(party_flips(seats(1.0, 1.0, 1.0, 1.0, 1.0), "house")["value"], "none")

    def test_dem_net_gain(self) -> None:
        rows = [seat(4.0, prior=-2.0, seat_no=1), *[seat(1.0, seat_no=i) for i in range(2, 6)]]

        claim = party_flips(rows, "house")

        self.assertEqual(claim["value"], "dem_net_gain")
        self.assertEqual(claim["display"]["dem_gains"], "1")
        self.assertEqual(claim["evidence"], ["2026:TX:house:1"])

    def test_rep_net_gain_and_even_exchange(self) -> None:
        rep = [seat(-4.0, prior=2.0, seat_no=1), *[seat(1.0, seat_no=i) for i in range(2, 6)]]
        even = [seat(-4.0, prior=2.0, seat_no=1), seat(4.0, prior=-2.0, seat_no=2), *[seat(1.0, seat_no=i) for i in range(3, 6)]]

        self.assertEqual(party_flips(rep, "house")["value"], "rep_net_gain")
        self.assertEqual(party_flips(even, "house")["value"], "even_exchange")

    def test_four_races_is_insufficient(self) -> None:
        self.assertEqual(party_flips(seats(1.0, 1.0, 1.0, 1.0), "house")["value"], "insufficient_data")


class IncumbencyTest(unittest.TestCase):
    def test_gap_and_significance_agree_at_the_cuts(self) -> None:
        for p, gap, tier in ((0.049, "rep_lower", "p_below_0_05"), (0.05, "rep_lower", "p_below_0_10"), (0.10, "no_difference", "p_at_or_above_0_10")):
            rows = fit("2026", 5.0, 3.0, p, diff=2.0)
            self.assertEqual(incumbency_party_gap(rows, GROUP)["value"], gap, p)
            self.assertEqual(significance(rows, GROUP)["value"], tier, p)

    def test_dem_lower(self) -> None:
        self.assertEqual(incumbency_party_gap(fit("2026", 1.0, 3.0, 0.01, diff=-2.0), GROUP)["value"], "dem_lower")

    def test_null_p(self) -> None:
        rows = fit("2026", None, 3.0, None, dem_seats=2)

        gap = incumbency_party_gap(rows, GROUP)
        sig = significance(rows, GROUP)

        self.assertEqual(gap["value"], "insufficient_data")
        self.assertEqual(gap["display"], {"dem_seats": "2", "rep_seats": "10"})
        self.assertEqual(sig["value"], "not_tested")
        self.assertEqual(sig["trigger_fields"], [])

    def test_display_and_evidence(self) -> None:
        claim = incumbency_party_gap(fit("2026", 10.2, 2.9, 0.0176, diff=7.27), GROUP)

        self.assertEqual(claim["display"]["wald_p"], "0.018")
        self.assertEqual(claim["display"]["dem_bonus"], "+10.20 points")
        self.assertIn("incumbency_presidential_lean.csv:house,red,2026,DEM", claim["evidence"])
        self.assertIn("incumbency_presidential_lean.csv:house,red,2026,REP", claim["evidence"])

    def test_tiny_p(self) -> None:
        self.assertEqual(significance(fit("2026", 5.0, 3.0, 1e-9), GROUP)["display"]["wald_p"], "less than 0.001")


class BonusHistoryTest(unittest.TestCase):
    def history(self, bonus_2026: float | None, prior: list[float | None]) -> list[Row]:
        rows = fit("2026", bonus_2026, 1.0, 0.5)
        for i, b in enumerate(prior):
            rows += fit(str(2014 + 2 * i), b, 1.0, 0.5)
        return rows

    def test_below_above_within(self) -> None:
        self.assertEqual(bonus_vs_history(self.history(0.5, [1.0, 2.0, 3.0]), GROUP, "DEM")["value"], "below_all_prior_years")
        self.assertEqual(bonus_vs_history(self.history(3.5, [1.0, 2.0, 3.0]), GROUP, "DEM")["value"], "above_all_prior_years")
        self.assertEqual(bonus_vs_history(self.history(3.0, [1.0, 2.0, 3.0]), GROUP, "DEM")["value"], "within_prior_range")

    def test_fewer_than_three_prior_years(self) -> None:
        claim = bonus_vs_history(self.history(0.5, [1.0, 2.0, None]), GROUP, "DEM")

        self.assertEqual(claim["value"], "insufficient_data")
        self.assertEqual(claim["display"], {"prior_years": "2"})

    def test_null_2026_bonus(self) -> None:
        self.assertEqual(bonus_vs_history(self.history(None, [1.0, 2.0, 3.0]), GROUP, "DEM")["value"], "insufficient_data")

    def test_rep_reads_rep_rows(self) -> None:
        claim = bonus_vs_history(self.history(9.0, [1.0, 2.0, 3.0]), GROUP, "REP")

        self.assertEqual(claim["value"], "within_prior_range")
        self.assertEqual(claim["display"]["prior_years"], "3")


class TurnoutTest(unittest.TestCase):
    def test_majorities_and_split(self) -> None:
        self.assertEqual(turnout_explanation(turnout("true", "true", "true", "false", "false"), "house")["value"], "turnout_plausible_majority")
        self.assertEqual(turnout_explanation(turnout("true", "true", "false", "false", "false"), "house")["value"], "persuasion_needed_majority")
        self.assertEqual(turnout_explanation(turnout("true", "true", "true", "false", "false", "false"), "house")["value"], "evenly_split")

    def test_insufficient(self) -> None:
        self.assertEqual(turnout_explanation(turnout("true", "true", "true", "false", ""), "house")["value"], "insufficient_data")

    def test_k_band_is_inclusive(self) -> None:
        def k(*ks: float) -> str:
            return k_direction(turnout(*["true"] * len(ks), ks=list(ks)), "house")["value"]

        self.assertEqual(k(1.02, 1.02, 1.02, 1.0, 1.1), "near_parity")
        self.assertEqual(k(0.98, 0.98, 0.98, 1.0, 0.9), "near_parity")
        self.assertEqual(k(1.03, 1.03, 1.03, 1.0, 1.1), "dem_relative_gain")
        self.assertEqual(k(0.97, 0.97, 0.97, 1.0, 0.9), "rep_relative_gain")
        self.assertEqual(k(1.0, 1.0, 1.0, 1.0), "insufficient_data")


class DummymanderTest(unittest.TestCase):
    def test_boundaries(self) -> None:
        self.assertEqual(dummymander(dummy({2026: -1.0}))["value"], "redrawn_incumbents_worse")
        self.assertEqual(dummymander(dummy({2026: 1.0}))["value"], "redrawn_incumbents_better")
        self.assertEqual(dummymander(dummy({2026: 0.5}))["value"], "no_clear_difference")

    def test_small_group(self) -> None:
        claim = dummymander(dummy({2026: -3.0}, redrawn_races=4))

        self.assertEqual(claim["value"], "insufficient_data")
        self.assertEqual(claim["display"], {"redrawn_races": "4", "not_redrawn_races": "100"})

    def test_history(self) -> None:
        largest = dummymander_vs_history(dummy({2016: -3.5, 2018: 5.4, 2026: -6.0}))
        within = dummymander_vs_history(dummy({2016: -3.5, 2018: 5.4, 2026: -5.4}))

        self.assertEqual(largest["value"], "largest_gap_on_record")
        self.assertEqual(within["value"], "within_prior_range")
        self.assertEqual(within["display"]["prior_max_year"], "2018")

    def test_history_insufficient(self) -> None:
        self.assertEqual(dummymander_vs_history(dummy({2026: -6.0}))["value"], "insufficient_data")
        self.assertEqual(dummymander_vs_history(dummy({2018: 5.0, 2026: -6.0}, redrawn_races=3))["value"], "insufficient_data")


class DummymanderPartyTest(unittest.TestCase):
    def test_boundaries(self) -> None:
        self.assertEqual(dummymander_party(dummy({2026: 1.0}))["value"], "redrawn_toward_dem")
        self.assertEqual(dummymander_party(dummy({2026: -1.0}))["value"], "redrawn_toward_rep")
        self.assertEqual(dummymander_party(dummy({2026: 0.5}))["value"], "no_clear_difference")

    def test_small_group(self) -> None:
        claim = dummymander_party(dummy({2026: 3.0}, redrawn_races=4))

        self.assertEqual(claim["value"], "insufficient_data")
        self.assertEqual(claim["display"], {"redrawn_races": "4", "not_redrawn_races": "100"})

    def test_evidence_names_party_file(self) -> None:
        self.assertEqual(dummymander_party(dummy({2026: 3.0}))["evidence"][0], "dummymander_party.csv:2026,house,redrawn")


def wash(p_2026: float | None, hist_races: int = 100) -> list[Row]:
    return [
        {
            "basis": "party",
            "hist_redrawn_mean": "1.0",
            "hist_not_redrawn_mean": "0.5",
            "hist_redrawn_races": str(hist_races),
            "hist_not_redrawn_races": "300",
            "hist_difference": "0.5",
            "difference_2026": "1.5",
            "excess": "1.0",
            "p_hist": "0.4",
            "p_2026": "" if p_2026 is None else str(p_2026),
            "p_excess": "0.2",
            "states": "50",
        }
    ]


class DummymanderTestTest(unittest.TestCase):
    def test_boundary(self) -> None:
        self.assertEqual(dummymander_test(wash(0.049), "party")["value"], "not_a_wash")
        self.assertEqual(dummymander_test(wash(0.05), "party")["value"], "consistent_with_wash")

    def test_insufficient(self) -> None:
        self.assertEqual(dummymander_test(wash(None), "party")["value"], "insufficient_data")
        self.assertEqual(dummymander_test(wash(0.01, hist_races=4), "party")["value"], "insufficient_data")
        self.assertEqual(dummymander_test([], "party")["value"], "insufficient_data")

    def test_historical_numbers_use_table_field_names(self) -> None:
        numbers = dummymander_test(wash(0.2), "party")["numbers"]

        self.assertEqual((numbers["redrawn_mean"], numbers["difference"], numbers["redrawn_races"]), (1.0, 0.5, 100))


class ByLeanTest(unittest.TestCase):
    def test_groups_by_presidential_lean_and_counts_excluded(self) -> None:
        rows = leaned(2, 2, 2, 2, 2) + leaned(-3, -3, -3, -3, -3, lean="blue") + [{**seat(5.0, seat_no=9, comparable=False), "presidential_lean": "red"}]

        red = seat_shift_by_lean(rows, "house", "red")
        blue = seat_shift_by_lean(rows, "house", "blue")

        self.assertEqual((red["value"], red["numbers"]["n"], red["numbers"]["excluded"]), ("toward_dem", 5, 1))
        self.assertEqual((blue["value"], blue["numbers"]["excluded"]), ("toward_rep", 0))
        self.assertEqual(red["rule"], rule_text()["seat_shift_by_lean"][1])
        self.assertEqual(red["display"]["excluded"], "1")

    def test_insufficient_below_the_minimum(self) -> None:
        claim = party_flips_by_lean(leaned(2, 2, 2, 2, lean="swing"), "house", "swing")

        self.assertEqual(claim["value"], "insufficient_data")
        self.assertEqual(claim["trigger_fields"], ["n", "excluded"])


class ClaimShapeTest(unittest.TestCase):
    """Every claim's trigger_fields are its family's DISPLAY or SPARSE_DISPLAY list, and every trigger field has a display string."""

    def claims(self) -> list[tuple[str, Claim]]:
        hist = fit("2026", 5.0, 3.0, 0.01) + fit("2014", 1.0, 1.0, 0.5) + fit("2016", 2.0, 2.0, 0.5) + fit("2018", 3.0, 3.0, 0.5)
        return [
            ("completeness", completeness(counts(), "t")),
            ("completeness", completeness(counts(ap=0), None)),
            ("seat_shift", seat_shift(seats(2, 2, 2, 2, 2), "house")),
            ("seat_shift", seat_shift([], "house")),
            ("party_flips", party_flips(seats(2, 2, 2, 2, 2), "house")),
            ("party_flips", party_flips([], "house")),
            ("seat_shift_by_lean", seat_shift_by_lean(leaned(2, 2, 2, 2, 2), "house", "red")),
            ("seat_shift_by_lean", seat_shift_by_lean([], "house", "red")),
            ("party_flips_by_lean", party_flips_by_lean(leaned(2, 2, 2, 2, 2), "house", "red")),
            ("party_flips_by_lean", party_flips_by_lean([], "house", "red")),
            ("incumbency_party_gap", incumbency_party_gap(hist, GROUP)),
            ("incumbency_party_gap", incumbency_party_gap([], GROUP)),
            ("significance", significance(hist, GROUP)),
            ("significance", significance([], GROUP)),
            ("bonus_vs_history", bonus_vs_history(hist, GROUP, "DEM")),
            ("bonus_vs_history", bonus_vs_history([], GROUP, "REP")),
            ("turnout_explanation", turnout_explanation(turnout(*["true"] * 5), "house")),
            ("turnout_explanation", turnout_explanation([], "house")),
            ("k_direction", k_direction(turnout(*["true"] * 5, ks=[1.0] * 5), "house")),
            ("k_direction", k_direction([], "house")),
            ("dummymander", dummymander(dummy({2026: -3.0}))),
            ("dummymander", dummymander([])),
            ("dummymander_vs_history", dummymander_vs_history(dummy({2018: 5.0, 2026: -6.0}))),
            ("dummymander_vs_history", dummymander_vs_history([])),
            ("dummymander_party", dummymander_party(dummy({2026: 3.0}))),
            ("dummymander_party", dummymander_party([])),
            ("dummymander_test", dummymander_test(wash(0.01), "party")),
            ("dummymander_test", dummymander_test(wash(0.2), "party")),
            ("dummymander_test", dummymander_test([], "party")),
        ]

    def test_trigger_fields_and_display(self) -> None:
        for family, claim in self.claims():
            expected = SPARSE_DISPLAY[family] if claim["value"] in SPARSE_VALUES else DISPLAY[family]
            self.assertIn(claim["value"], FAMILIES[family], family)
            self.assertEqual(claim["trigger_fields"], list(expected), (family, claim["value"]))
            self.assertEqual(set(claim["display"]), set(expected), (family, claim["value"]))
            self.assertTrue(claim["rule"], family)
            self.assertIn(claim["rule"], rule_text()[family], family)
            for field in DISPLAY[family]:
                self.assertIn(field, claim["numbers"], (family, field))


class FormatTest(unittest.TestCase):
    def test_formats(self) -> None:
        self.assertEqual(fmt.points(0.001), "0.00 points")
        self.assertEqual(fmt.points(-0.5), f"{fmt.MINUS}0.50 points")
        self.assertEqual(fmt.points(None), "not available")
        self.assertEqual(fmt.p_value(0.0496, (0.05, 0.10)), "0.0496")
        self.assertEqual(fmt.ratio(1.0204, (0.98, 1.02)), "1.0204")
        self.assertEqual(fmt.percent(0.5), "50.0 percent")
        self.assertEqual(THRESHOLDS.as_json()["p_tiers"], [0.05, 0.10])


if __name__ == "__main__":
    unittest.main()
