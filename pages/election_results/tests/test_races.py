import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from lib.model import CandidateRow, Party, Round, SourceFormatError, State
from lib.races import apply_overrides, collapse_to_races
from lib.source_table import Source, SourceTable

OVERRIDE_HEADER = "year,state,office,seat,special,round,candidate,party,votes,official,source_id\n"


def cand(name: str, party: Party, votes: int, total: int, round_: Round = "general", state: str = "GA", seat: int = 2) -> CandidateRow:
    return CandidateRow(
        year=2020, state=State(state), office="senate", seat=seat, special=False, round=round_, candidate=name, party=party,
        votes=votes, total_votes=total, pct=100.0 * votes / total, incumbent=False, unofficial=False, source="test", fetched_at="t",
    )  # fmt: skip


class CollapseTests(unittest.TestCase):
    def test_top_democrat_and_republican_with_other_votes(self) -> None:
        rows = [cand("A DEM", "DEM", 480, 1000), cand("B REP", "REP", 500, 1000), cand("C LIB", "OTHER", 20, 1000)]

        (race,) = collapse_to_races(rows)

        self.assertEqual((race.dem_candidate, race.dem_votes, race.gop_candidate, race.gop_votes), ("A DEM", 480, "B REP", 500))
        self.assertEqual((race.other_votes, race.total_votes, race.winner_party), (20, 1000, "REP"))
        self.assertAlmostEqual(race.gop_pct or 0.0, 50.0)

    def test_race_with_no_republican_has_null_gop_fields_and_stays(self) -> None:
        rows = [cand("A DEM", "DEM", 600, 1000, state="CA"), cand("B DEM", "DEM", 400, 1000, state="CA")]

        (race,) = collapse_to_races(rows)

        self.assertEqual((race.gop_candidate, race.gop_votes, race.gop_pct), (None, None, None))
        self.assertEqual((race.dem_candidate, race.other_votes, race.winner_party), ("A DEM", 400, "DEM"))

    def test_uncounted_uncontested_race_stays_with_null_counts_and_its_winner(self) -> None:
        frost = replace(cand("FROST", "DEM", 1, 1, state="FL", seat=10), office="house", votes=None, total_votes=None, pct=None)

        (race,) = collapse_to_races([frost])

        self.assertEqual((race.dem_candidate, race.dem_votes, race.dem_pct, race.gop_candidate), ("FROST", None, None, None))
        self.assertEqual((race.other_votes, race.total_votes, race.winner_party), (None, None, "DEM"))

    def test_runoff_is_the_deciding_round(self) -> None:
        rows = [
            cand("PERDUE", "REP", 2462617, 4952175),
            cand("OSSOFF", "DEM", 2374519, 4952175),
            cand("PERDUE", "REP", 2213979, 4483241, round_="runoff"),
            cand("OSSOFF", "DEM", 2269262, 4483241, round_="runoff"),
        ]

        (race,) = collapse_to_races(rows)

        self.assertEqual((race.round, race.dem_votes, race.winner_party, race.total_votes), ("runoff", 2269262, "DEM", 4483241))

    def test_one_row_per_seat_and_special(self) -> None:
        rows = [cand("A", "DEM", 1, 2), cand("B", "REP", 1, 2), cand("C", "DEM", 3, 4, seat=3), cand("D", "REP", 1, 4, seat=3)]

        races = collapse_to_races(rows)

        self.assertEqual([r.seat for r in races], [2, 3])
        self.assertEqual([r.incumbent_running for r in races], [False, False])


class OverrideTests(unittest.TestCase):
    def setUp(self) -> None:
        self.table = SourceTable([Source(1, "GA SOS", "", "2026-11-05"), Source(2, "AK DOE", "", "2026-11-05"), Source(3, "ME SOS", "", "2026-11-05"), Source(4, "CT SOTS", "", "2026-11-05"), Source(5, "s", "", "c")])

    def overrides(self, body: str, header: str = OVERRIDE_HEADER) -> Path:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        path = Path(tmp.name) / "result_overrides.csv"
        path.write_text(header + body)
        return path

    def test_runoff_override_decides_the_race_under_the_cycle_year(self) -> None:
        general = [cand("PERDUE", "REP", 2462617, 4952175), cand("OSSOFF", "DEM", 2374519, 4952175)]
        path = self.overrides("2021,GA,senate,2,false,runoff,Jon Ossoff,DEM,2269923,true,1\n2021,GA,senate,2,false,runoff,David Perdue,REP,2214979,true,1\n")

        rows = apply_overrides(general, path, self.table)
        (race,) = collapse_to_races(rows)

        runoff = [r for r in rows if r.round == "runoff"]
        self.assertEqual({(r.year, r.candidate, r.total_votes) for r in runoff}, {(2020, "Jon Ossoff", 4484902), (2020, "David Perdue", 4484902)})
        self.assertEqual((race.year, race.round, race.dem_votes, race.total_votes, race.winner_party), (2020, "runoff", 2269923, 4484902, "DEM"))
        self.assertEqual(len(rows), 4)  # round one stays as history

    def test_override_replaces_rows_of_the_same_round(self) -> None:
        medsl = [cand("MURKOWSKI, LISA", "OTHER", 114118, 262000, state="AK", seat=3), cand("TSHIBAKA, KELLY C.", "OTHER", 112101, 262000, state="AK", seat=3)]
        path = self.overrides("2020,AK,senate,3,false,general,Lisa Murkowski,REP,114118,true,2\n2020,AK,senate,3,false,general,Kelly Tshibaka,REP,112101,true,2\n")

        rows = apply_overrides(medsl, path, self.table)

        self.assertEqual(sorted((r.candidate, r.party, r.source) for r in rows), [("Kelly Tshibaka", "REP", "AK DOE"), ("Lisa Murkowski", "REP", "AK DOE")])

    def test_ranked_choice_override_stores_the_final_round(self) -> None:
        general = [cand("GOLDEN", "DEM", 132013, 289624, state="ME", seat=2), cand("POLIQUIN", "REP", 134184, 289624, state="ME", seat=2)]
        path = self.overrides("2020,ME,senate,2,false,rcv_final,Jared Golden,DEM,142440,true,3\n2020,ME,senate,2,false,rcv_final,Bruce Poliquin,REP,138931,true,3\n")

        (race,) = collapse_to_races(apply_overrides(general, path, self.table))

        self.assertEqual((race.round, race.dem_votes, race.gop_votes, race.winner_party), ("rcv_final", 142440, 138931, "DEM"))

    def test_override_for_a_race_the_source_lacks_adds_it(self) -> None:
        path = self.overrides("2022,CT,senate,3,false,general,Richard Blumenthal,DEM,723864,true,4\n")

        (row,) = apply_overrides([], path, self.table)

        self.assertEqual((row.year, row.state, row.office, row.seat, row.pct, row.unofficial, row.fetched_at), (2022, "CT", "senate", 3, 100.0, False, "2026-11-05"))

    def test_missing_column_raises_naming_it(self) -> None:
        path = self.overrides("2022,CT,senate,3,false,general,X,DEM,1,false\n", header=OVERRIDE_HEADER.replace(",source_id", ""))

        with self.assertRaises(SourceFormatError) as caught:
            apply_overrides([], path, self.table)

        self.assertIn("source_id", str(caught.exception))

    def test_unreadable_value_raises_naming_the_line(self) -> None:
        path = self.overrides("2022,CT,senate,3,false,general,X,Democrat,1,true,5\n")

        with self.assertRaises(SourceFormatError) as caught:
            apply_overrides([], path, self.table)

        self.assertIn("line 2", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
