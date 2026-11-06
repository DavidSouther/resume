import csv
import tempfile
import unittest
from dataclasses import replace
from datetime import date
from pathlib import Path

from lib.enrich import (
    GovernorIncumbent,
    flag_incumbent_candidates,
    governor_incumbency,
    house_incumbency,
    mark_redrawn,
    presidential_lean,
    read_redistricting,
    senate_delegation,
    senate_incumbency,
)
from lib.medsl import PresidentialResult
from lib.model import CandidateRow, Office, Party, RaceRow, SourceFormatError, State
from lib.races import collapse_to_races
from lib.source_table import Source, SourceTable
from tests.legislator_fixtures import HOUSE, SENATORS, terms

REDISTRICTING = Path(__file__).resolve().parent.parent / "data" / "overrides" / "redistricting.csv"
SOURCES = SourceTable.load(Path(__file__).resolve().parent.parent / "data" / "sources.csv")


def cand(year: int, state: str, office: Office, seat: int, name: str, party: Party, votes: int, special: bool = False, incumbent: bool = False) -> CandidateRow:
    return CandidateRow(
        year=year, state=State(state), office=office, seat=seat, special=special, round="general", candidate=name, party=party,
        votes=votes, total_votes=0, pct=0.0, incumbent=incumbent, unofficial=False, source="test", fetched_at="t",
    )  # fmt: skip


def race_of(candidates: list[CandidateRow]) -> list[RaceRow]:
    return collapse_to_races(candidates)


class SenateIncumbencyTests(unittest.TestCase):
    def test_appointee_is_not_senate_incumbent(self) -> None:
        cands = [cand(2026, "OH", "senate", 3, "Jon Husted", "REP", 100, special=True), cand(2026, "OH", "senate", 3, "Sherrod Brown", "DEM", 110, special=True)]

        (out,) = senate_incumbency(race_of(cands), cands, terms(*SENATORS))

        self.assertEqual((out.incumbent_running, out.incumbent_party, out.incumbent_name), (False, "REP", None))

    def test_continuous_incumbent_running_is_matched_by_nickname(self) -> None:
        cands = [cand(2018, "TX", "senate", 1, "TED CRUZ", "REP", 4260553), cand(2018, "TX", "senate", 1, "BETO O'ROURKE", "DEM", 4045632)]

        (out,) = senate_incumbency(race_of(cands), cands, terms(*SENATORS))

        self.assertEqual((out.incumbent_running, out.incumbent_party, out.incumbent_name), (True, "REP", "TED CRUZ"))

    def test_special_election_winner_with_two_years_of_service_is_incumbent(self) -> None:
        cands = [cand(2020, "AL", "senate", 2, "DOUG JONES", "DEM", 920478), cand(2020, "AL", "senate", 2, "TOMMY TUBERVILLE", "REP", 1392076)]

        (out,) = senate_incumbency(race_of(cands), cands, terms(*SENATORS))

        self.assertEqual((out.incumbent_running, out.incumbent_party), (True, "DEM"))

    def test_independents_are_incumbents_of_their_caucus_party_and_keep_other_on_the_ballot(self) -> None:
        cands = [
            cand(2018, "ME", "senate", 1, "ANGUS S. KING, JR.", "OTHER", 344575),
            cand(2018, "ME", "senate", 1, "ERIC L. BRAKEY", "REP", 223502),
            cand(2018, "VT", "senate", 1, "BERNIE SANDERS", "OTHER", 183529),
            cand(2018, "VT", "senate", 1, "LAWRENCE ZUPAN", "REP", 74663),
        ]

        out = senate_incumbency(race_of(cands), cands, terms(*SENATORS))
        flagged = flag_incumbent_candidates(cands, out)

        self.assertEqual([(r.state, r.incumbent_party, r.incumbent_running) for r in out], [("ME", "DEM", True), ("VT", "DEM", True)])
        self.assertEqual({(c.candidate, c.party) for c in flagged if c.incumbent}, {("ANGUS S. KING, JR.", "OTHER"), ("BERNIE SANDERS", "OTHER")})

    def test_retiring_incumbent_leaves_an_open_seat_with_the_defending_party(self) -> None:
        cands = [cand(2022, "VT", "senate", 3, "PETER WELCH", "DEM", 196575), cand(2022, "VT", "senate", 3, "GERALD MALLOY", "REP", 80468)]

        (out,) = senate_incumbency(race_of(cands), cands, terms(*SENATORS))

        self.assertEqual((out.incumbent_running, out.incumbent_party, out.incumbent_name), (False, "DEM", "Patrick Leahy"))

    def test_other_offices_pass_through(self) -> None:
        cands = [cand(2018, "PA", "house", 6, "CHRISSY HOULAHAN", "DEM", 1)]
        races = race_of(cands)

        self.assertEqual(senate_incumbency(races, cands, terms(*SENATORS)), races)


class HouseIncumbencyTests(unittest.TestCase):
    def pa_2018(self) -> tuple[list[RaceRow], list[CandidateRow]]:
        cands = [
            cand(2018, "PA", "house", 17, "CONOR LAMB", "DEM", 183162),
            cand(2018, "PA", "house", 17, "KEITH J. ROTHFUS", "REP", 149306),
            cand(2018, "PA", "house", 6, "CHRISSY HOULAHAN", "DEM", 177704),
            cand(2018, "PA", "house", 6, "GREG MCCAULEY", "REP", 124124),
            cand(2018, "PA", "house", 1, "BRIAN FITZPATRICK", "REP", 169053),
            cand(2018, "PA", "house", 1, "SCOTT WALLACE", "DEM", 160745),
            cand(2018, "PA", "house", 15, "GLENN THOMPSON", "REP", 1),
            cand(2018, "PA", "house", 18, "MIKE DOYLE", "DEM", 1),
        ]
        return house_incumbency(race_of(cands), cands, terms(*HOUSE)), cands

    def test_member_running_in_a_renumbered_district_is_the_incumbent_there(self) -> None:
        races, _ = self.pa_2018()

        first = next(r for r in races if r.seat == 1)

        self.assertEqual((first.incumbent_running, first.incumbent_party, first.incumbent_name, first.paired_incumbents), (True, "REP", "BRIAN FITZPATRICK", False))

    def test_two_incumbents_in_one_district_set_the_paired_flag(self) -> None:
        races, cands = self.pa_2018()

        seventeenth = next(r for r in races if r.seat == 17)
        flagged = {c.candidate for c in flag_incumbent_candidates(cands, races) if c.incumbent}

        self.assertTrue(seventeenth.paired_incumbents)
        self.assertTrue(seventeenth.incumbent_running)
        self.assertLessEqual({"CONOR LAMB", "KEITH J. ROTHFUS"}, flagged)
        self.assertEqual([r.seat for r in races if r.paired_incumbents], [17])

    def test_open_seat_keeps_the_defending_party(self) -> None:
        races, _ = self.pa_2018()

        sixth = next(r for r in races if r.seat == 6)

        self.assertEqual((sixth.incumbent_running, sixth.incumbent_party, sixth.incumbent_name), (False, "REP", "Ryan Costello"))

    def test_vacant_seat_takes_the_party_of_the_last_member(self) -> None:
        races, _ = self.pa_2018()

        fifteenth = next(r for r in races if r.seat == 15)

        self.assertEqual((fifteenth.incumbent_running, fifteenth.incumbent_party), (False, "REP"))

    def test_special_election_has_no_incumbent_running_and_the_vacating_members_party(self) -> None:
        cands = [cand(2018, "PA", "house", 18, "CONOR LAMB", "DEM", 114102, special=True), cand(2018, "PA", "house", 18, "RICK SACCONE", "REP", 113347, special=True)]

        (out,) = house_incumbency(race_of(cands), cands, terms(*HOUSE))

        self.assertEqual((out.incumbent_running, out.incumbent_party, out.incumbent_name), (False, "REP", "Tim Murphy"))

    def test_multi_word_last_name_matches(self) -> None:
        cands = [cand(2022, "TX", "house", 18, "SHEILA JACKSON LEE", "DEM", 1), cand(2022, "TX", "house", 18, "CARMEN MONTIEL", "REP", 1)]

        (out,) = house_incumbency(race_of(cands), cands, terms(*HOUSE))

        self.assertEqual((out.incumbent_running, out.incumbent_party), (True, "DEM"))


class GovernorIncumbencyTests(unittest.TestCase):
    def test_open_seat_takes_the_infobox_party(self) -> None:
        cands = [cand(2018, "GA", "governor", 0, "Brian Kemp", "REP", 1978408), cand(2018, "GA", "governor", 0, "Stacey Abrams", "DEM", 1923685)]
        incumbents = {(2018, State("GA"), False): GovernorIncumbent("Nathan Deal", "REP")}

        (out,) = governor_incumbency(race_of(cands), cands, incumbents)

        self.assertEqual((out.incumbent_running, out.incumbent_party, out.incumbent_name), (False, "REP", "Nathan Deal"))

    def test_running_incumbent_is_found_by_name_or_by_the_page_marker(self) -> None:
        cands = [
            cand(2014, "AK", "governor", 0, "Sean Parnell", "REP", 128435),
            cand(2014, "AK", "governor", 0, "Bill Walker", "OTHER", 134658),
            cand(2022, "NY", "governor", 0, "Kathy Hochul", "DEM", 3140415, incumbent=True),
            cand(2022, "NY", "governor", 0, "Lee Zeldin", "REP", 2762581),
        ]
        incumbents = {(2014, State("AK"), False): GovernorIncumbent("Sean Parnell", "REP"), (2022, State("NY"), False): GovernorIncumbent("Kathleen Hochul", "DEM")}

        out = governor_incumbency(race_of(cands), cands, incumbents)

        self.assertEqual([(r.state, r.incumbent_running, r.incumbent_name) for r in out], [("AK", True, "Sean Parnell"), ("NY", True, "Kathy Hochul")])

    def test_race_without_an_infobox_incumbent_is_left_unknown(self) -> None:
        cands = [cand(2018, "GA", "governor", 0, "Brian Kemp", "REP", 1)]

        (out,) = governor_incumbency(race_of(cands), cands, {})

        self.assertEqual((out.incumbent_running, out.incumbent_party, out.incumbent_name), (False, None, None))


class RedrawnTests(unittest.TestCase):
    def test_redrawn_marks_census_and_mid_cycle_house_races_only(self) -> None:
        cands = [
            cand(2026, "TX", "house", 9, "A", "DEM", 1),
            cand(2022, "TX", "house", 9, "B", "DEM", 1),
            cand(2024, "TX", "house", 9, "B", "DEM", 1),
            cand(2018, "PA", "house", 17, "C", "DEM", 1),
            cand(2016, "FL", "house", 5, "D", "DEM", 1),
            cand(2016, "VA", "house", 4, "D", "DEM", 1),
            cand(2020, "NC", "house", 2, "E", "DEM", 1),
            cand(2022, "WY", "house", 0, "F", "REP", 1),
            cand(2022, "TX", "senate", 1, "G", "REP", 1),
            cand(2022, "TX", "governor", 0, "H", "REP", 1),
        ]

        out = {(r.year, r.state, r.office): r.redrawn for r in mark_redrawn(race_of(cands), REDISTRICTING, SOURCES)}

        self.assertEqual(
            out,
            {
                (2026, "TX", "house"): True, (2022, "TX", "house"): True, (2024, "TX", "house"): False, (2018, "PA", "house"): True,
                (2016, "FL", "house"): True, (2016, "VA", "house"): True, (2020, "NC", "house"): True, (2022, "WY", "house"): False,
                (2022, "TX", "senate"): False, (2022, "TX", "governor"): False,
            },
        )  # fmt: skip

    def test_every_row_has_a_known_kind_and_mid_cycle_rows_cite_ballotpedia(self) -> None:
        rows = read_redistricting(REDISTRICTING, SOURCES)

        self.assertEqual({r.kind for r in rows}, {"census", "mid_cycle"})
        for row in rows:
            self.assertTrue(row.source.startswith("Ballotpedia: "), row)
        mid = {(r.state, r.first_election_year) for r in rows if r.kind == "mid_cycle"}
        self.assertLessEqual({("FL", 2016), ("NC", 2016), ("VA", 2016), ("PA", 2018), ("NC", 2020), ("TX", 2026), ("CA", 2026), ("OH", 2026), ("UT", 2026)}, mid)
        self.assertNotIn(("MO", 2026), mid)  # enacted, but the 2022 map was used for the 2026 general election

    def test_missing_column_or_unknown_source_raises_naming_it(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        table = SourceTable([Source(1, "Ballotpedia: x", "https://ballotpedia.org/x", "")])
        no_source = Path(tmp.name) / "a.csv"
        no_source.write_text("state,first_election_year,kind\nTX,2026,mid_cycle\n")
        empty_source = Path(tmp.name) / "b.csv"
        empty_source.write_text("state,first_election_year,kind,source_id\nTX,2026,mid_cycle,\n")
        bad_kind = Path(tmp.name) / "c.csv"
        bad_kind.write_text("state,first_election_year,kind,source_id\nTX,2026,court,1\n")

        with self.assertRaisesRegex(SourceFormatError, "source_id"):
            read_redistricting(no_source, table)
        with self.assertRaisesRegex(SourceFormatError, "line 2"):
            read_redistricting(empty_source, table)
        with self.assertRaisesRegex(SourceFormatError, "court"):
            read_redistricting(bad_kind, table)


class LeanTests(unittest.TestCase):
    def test_margin_of_exactly_five_is_swing_and_above_it_takes_the_winner(self) -> None:
        results = [
            PresidentialResult(2020, State("AA"), 500, 450, 1000),
            PresidentialResult(2020, State("BB"), 449, 500, 1000),
            PresidentialResult(2020, State("CC"), 551, 500, 1000),
        ]

        out = {r["state"]: (r["margin"], r["lean"]) for r in presidential_lean(results, [2022])}

        self.assertEqual(out, {"AA": (5.0, "swing"), "BB": (-5.1, "red"), "CC": (5.1, "blue")})

    def test_presidential_years_look_four_years_back_and_odd_years_to_the_last_election(self) -> None:
        results = [PresidentialResult(2016, State("PA"), 480, 490, 1000), PresidentialResult(2020, State("PA"), 600, 400, 1000)]

        out = {r["year"]: (r["president_year"], r["lean"]) for r in presidential_lean(results, [2019, 2020, 2021, 2022])}

        self.assertEqual(out, {2019: (2016, "swing"), 2020: (2016, "swing"), 2021: (2020, "blue"), 2022: (2020, "blue")})

    def test_delegation_counts_independents_by_caucus(self) -> None:
        elections = [(State("ME"), date(2026, 11, 3)), (State("OH"), date(2026, 11, 3)), (State("WV"), date(2024, 11, 5)), (State("VT"), date(2018, 11, 6))]

        out = {(r["state"], r["year"]): r for r in senate_delegation(terms(*SENATORS), elections)}

        self.assertEqual(out[("ME", 2026)]["lean"], "purple")
        self.assertEqual({out[("ME", 2026)]["senator1"], out[("ME", 2026)]["senator2"]}, {"Angus King", "Susan Collins"})
        self.assertEqual(out[("OH", 2026)]["lean"], "red")
        self.assertEqual(out[("WV", 2024)]["lean"], "purple")  # Manchin, an independent caucusing with Democrats after May 2024
        self.assertEqual(out[("VT", 2018)]["lean"], "blue")
        self.assertEqual(out[("ME", 2026)]["election_date"], "2026-11-03")


class FlagTests(unittest.TestCase):
    def test_flags_follow_the_race_rule_not_the_page_marker(self) -> None:
        cands = [cand(2026, "OH", "senate", 3, "Jon Husted", "REP", 100, special=True, incumbent=True)]
        races = senate_incumbency(race_of(cands), cands, terms(*SENATORS))

        (out,) = flag_incumbent_candidates(cands, races)

        self.assertFalse(out.incumbent)
        self.assertEqual(replace(out, incumbent=True), cands[0])


class WriteTests(unittest.TestCase):
    def test_redistricting_rows_are_sorted_by_state_and_year(self) -> None:
        with REDISTRICTING.open(newline="") as f:
            rows = [(r["state"], int(r["first_election_year"])) for r in csv.DictReader(f)]

        self.assertEqual(rows, sorted(rows))
