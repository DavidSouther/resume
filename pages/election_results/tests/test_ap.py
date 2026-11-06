import gzip
import json
import unittest
from pathlib import Path
from typing import Any

from lib.ap import ApPull, RaceKey, keep_uncovered, parse_ap, party_of, race_name
from lib.model import CandidateRow, State

SAMPLES = Path(__file__).parent / "samples"
AT = "2026-11-05T15:30:00Z"


def load(name: str) -> dict[str, Any]:
    payload: dict[str, Any] = json.loads((SAMPLES / name).read_text())
    return payload


def pull() -> ApPull:
    return parse_ap(load("ap_2026_metadata.json"), load("ap_2026_progress.json"), 2026, AT)


def race(result: ApPull, state: str, office: str, seat: int) -> list[CandidateRow]:
    return [r for r in result.rows if (r.state, r.office, r.seat) == (state, office, seat)]


class ParseApTests(unittest.TestCase):
    def test_at_large_house_seat_is_district_zero_with_ap_source_and_fetch_time(self) -> None:
        rows = race(pull(), "AK", "house", 0)

        begich = next(r for r in rows if "Begich" in r.candidate)
        self.assertEqual((begich.candidate, begich.party, begich.votes, begich.round, begich.special), ("Nick Begich III", "REP", 105647, "general", False))
        self.assertEqual((begich.source, begich.fetched_at, begich.unofficial, begich.year), ("ap", AT, True, 2026))
        self.assertEqual(begich.total_votes, sum(r.votes or 0 for r in rows))
        self.assertEqual(next(r for r in rows if "Hill" in r.candidate).party, "OTHER")

    def test_numbered_district_keeps_its_number(self) -> None:
        rows = race(pull(), "TX", "house", 26)

        self.assertEqual({r.party for r in rows}, {"DEM", "REP", "OTHER"})
        self.assertEqual(next(r for r in rows if r.party == "REP").candidate, "Brandon Gill")

    def test_senate_seat_is_the_class_and_a_special_general_is_flagged(self) -> None:
        result = pull()

        ohio = race(result, "OH", "senate", 3)
        texas = race(result, "TX", "senate", 2)

        self.assertTrue(ohio and all(r.special for r in ohio))
        self.assertTrue(texas and not any(r.special for r in texas))
        self.assertEqual(next(r for r in ohio if r.party == "DEM").candidate, "Sherrod Brown")

    def test_governor_seat_is_zero(self) -> None:
        rows = race(pull(), "GA", "governor", 0)

        self.assertEqual({r.party for r in rows}, {"DEM", "REP"})

    def test_uncounted_uncontested_race_keeps_its_winner_with_null_counts(self) -> None:
        result = pull()

        (frost,) = race(result, "FL", "house", 10)

        self.assertEqual((frost.candidate, frost.party, frost.votes, frost.total_votes, frost.pct), ("Maxwell Frost", "DEM", None, None, None))
        self.assertIn("2026 FL house district 10: uncontested and not counted, so its votes are null", result.notes)

    def test_counted_uncontested_race_keeps_its_count(self) -> None:
        (mcgovern,) = race(pull(), "MA", "house", 2)

        self.assertEqual((mcgovern.votes, mcgovern.pct), (198782, 100.0))

    def test_candidate_caucusing_with_a_party_keeps_other_on_the_candidate_row(self) -> None:
        kiley = next(r for r in race(pull(), "CA", "house", 6) if "Kiley" in r.candidate)

        self.assertEqual(kiley.party, "OTHER")  # incumbency enrichment applies the caucus party, as for King and Sanders

    def test_ballot_lines_and_empty_write_in_totals_are_dropped_and_counted_write_ins_kept(self) -> None:
        maine = race(pull(), "ME", "house", 2)
        georgia = race(pull(), "GA", "house", 11)

        self.assertFalse(any("Blank" in r.candidate for r in maine))
        self.assertEqual(next(r for r in maine if "write-in" in r.candidate).party, "OTHER")
        self.assertFalse(any("Write-ins" in r.candidate for r in georgia))

    def test_ranked_choice_without_a_majority_is_noted_as_first_round_only(self) -> None:
        notes = pull().notes

        self.assertTrue(any(n.startswith("2026 AK house district 0: ranked choice, AP reports the first round only") for n in notes), notes)
        # Maine's second district leader holds a majority once blank ballots are set aside, so the first round decides it.
        self.assertFalse(any(n.startswith("2026 ME house district 2: ranked choice") for n in notes), notes)

    def test_runoff_is_noted_with_the_candidates_advancing(self) -> None:
        result = pull()

        self.assertTrue(race(result, "LA", "house", 5))
        self.assertIn("2026 LA house district 5: AP reports a runoff between Patricia Moore and Gabe Firment, so the November round is stored", "\n".join(result.notes))

    def test_runoff_state_race_without_a_majority_is_noted_as_a_possible_runoff(self) -> None:
        metadata, progress = load("ap_2026_metadata.json"), load("ap_2026_progress.json")
        metadata["20261103LA20560"]["raceCallStatus"] = "Too Early to Call"
        for candidate in progress["20261103LA20560"]["candidates"]:
            candidate.pop("winner", None)

        notes = parse_ap(metadata, progress, 2026, AT).notes

        self.assertIn("2026 LA house district 5: no candidate has a majority in a state with runoffs, so a runoff may follow", notes)
        self.assertFalse(any(n.startswith("2026 GA governor") for n in notes), notes)

    def test_national_aggregate_and_other_offices_are_not_read(self) -> None:
        result = pull()

        self.assertFalse(any(r.state not in ("AK", "OH", "TX", "FL", "MA", "CA", "LA", "ME", "GA") for r in result.rows))
        self.assertFalse(any(r.state == "AL" for r in result.rows))
        self.assertTrue(any("20261103US999999" in n for n in result.notes), result.notes)

    def test_each_race_below_the_full_expected_vote_is_listed_with_its_eevp(self) -> None:
        eevp = pull().eevp

        self.assertIn("2026 AK house district 0: eevp 73.98, last updated 2026-11-05T15:28:06Z", eevp)
        self.assertEqual(len(eevp), 11)  # every race read; AP caps a called race at 99

    def test_certified_race_is_official(self) -> None:
        metadata, progress = load("ap_2026_metadata.json"), load("ap_2026_progress.json")
        metadata["20261103TX46643"]["isCertified"] = True

        rows = parse_ap(metadata, progress, 2026, AT).rows

        self.assertFalse(any(r.unofficial for r in rows if (r.state, r.office) == ("TX", "senate")))
        self.assertTrue(all(r.unofficial for r in rows if (r.state, r.office) == ("OH", "senate")))

    def test_race_missing_from_progress_is_noted_not_written(self) -> None:
        metadata, progress = load("ap_2026_metadata.json"), load("ap_2026_progress.json")
        del progress["20261103TX45896"]

        result = parse_ap(metadata, progress, 2026, AT)

        self.assertFalse(race(result, "TX", "house", 26))
        self.assertTrue(any(n.startswith("2026 TX house district 26: no progress") for n in result.notes), result.notes)


class PartyTests(unittest.TestCase):
    def test_major_codes_and_everything_else(self) -> None:
        self.assertEqual([party_of(c) for c in ("Dem", "GOP", "Ind", "Lib", "NPP", "Grn")], ["DEM", "REP", "OTHER", "OTHER", "OTHER", "OTHER"])


class RaceNameTests(unittest.TestCase):
    def test_names_match_the_wikipedia_parser(self) -> None:
        self.assertEqual(race_name((2026, State("TX"), "house", 26, False)), "2026 TX house district 26")
        self.assertEqual(race_name((2026, State("OH"), "senate", 3, True)), "2026 OH senate special")
        self.assertEqual(race_name((2026, State("GA"), "governor", 0, False)), "2026 GA governor")


class KeepUncoveredTests(unittest.TestCase):
    def test_rows_and_notes_of_covered_races_and_their_state_pages_are_dropped(self) -> None:
        def row(state: str, seat: int) -> CandidateRow:
            return CandidateRow(2026, State(state), "house", seat, False, "general", "A", "DEM", 1, 1, 100.0, False, True, "wiki", AT)

        covered: set[RaceKey] = {(2026, State("TX"), "house", 1, False)}
        notes = ["2026 TX house district 1: the general election box has no votes", "2026 TX house district 2: no votes", "2026 TX house: no district election boxes on X"]

        rows, kept = keep_uncovered([row("TX", 1), row("TX", 2)], notes, covered)

        self.assertEqual([r.seat for r in rows], [2])
        self.assertEqual(kept, ["2026 TX house district 2: no votes"])


class GzipTests(unittest.TestCase):
    def test_gzip_reply_is_decoded(self) -> None:
        from lib.sources import decode_body

        self.assertEqual(decode_body(gzip.compress(b"{}"), "gzip"), b"{}")
        self.assertEqual(decode_body(b"{}", None), b"{}")
