import unittest
from datetime import date
from pathlib import Path

from lib.legislators import PersonName, caucus_party, general_election_day, name_strength, parse_legislators, person_from_display
from lib.medsl import parse_medsl_president
from lib.model import SourceFormatError
from lib.turnout import parse_turnout
from tests.legislator_fixtures import SENATORS, person, sen, terms

SAMPLES = Path(__file__).parent / "samples"


class LegislatorTests(unittest.TestCase):
    def test_terms_carry_state_class_dates_and_caucus_party(self) -> None:
        (king,) = [t for t in terms(*SENATORS) if t.name.last == "King" and t.start == date(2019, 1, 3)]

        self.assertEqual((king.chamber, king.state, king.senate_class, king.end), ("sen", "ME", 1, date(2031, 1, 3)))
        self.assertEqual(king.party_on(date(2024, 11, 4)), "DEM")

    def test_party_switch_inside_a_term_uses_the_span_for_the_day(self) -> None:
        (manchin,) = [t for t in terms(*SENATORS) if t.name.last == "Manchin"]

        self.assertEqual(manchin.party_on(date(2020, 1, 1)), "DEM")
        self.assertEqual(manchin.party_on(date(2024, 11, 4)), "DEM")
        self.assertEqual(caucus_party("Independent", None), "OTHER")
        self.assertEqual(caucus_party("Libertarian", "Republican"), "REP")

    def test_missing_key_raises_naming_it(self) -> None:
        broken = person("X000001", "A", "B", [{"type": "sen", "state": "OH", "class": 1, "end": "2027-01-03", "party": "Republican"}])

        with self.assertRaisesRegex(SourceFormatError, "start"):
            parse_legislators([[broken]], "legislators-current.json")

    def test_house_terms_need_a_district(self) -> None:
        broken = person("X000002", "A", "B", [{"type": "rep", "state": "OH", "start": "2025-01-03", "end": "2027-01-03", "party": "Republican"}])

        with self.assertRaisesRegex(SourceFormatError, "district"):
            parse_legislators([[broken]], "legislators-current.json")

    def test_other_term_types_are_skipped(self) -> None:
        out = parse_legislators([[person("X000003", "A", "B", [sen("OH", 1, "2025-01-03", "2027-01-03"), {"type": "prez", "start": "2025-01-20", "end": "2029-01-20"}])]], "x")

        self.assertEqual(len(out), 1)


class NameTests(unittest.TestCase):
    def test_full_nick_and_middle_names_are_strong_matches(self) -> None:
        cruz = PersonName("Rafael", "Cruz", nickname="Ted")
        self.assertEqual(name_strength("TED CRUZ", cruz), 2)
        self.assertEqual(name_strength("RAFAEL EDWARD CRUZ", cruz), 2)
        self.assertEqual(name_strength("R. CRUZ", cruz), 1)
        self.assertEqual(name_strength("TED BUDD", cruz), 0)
        self.assertEqual(name_strength("BETO O'ROURKE", PersonName("Robert", "O'Rourke", nickname="Beto")), 2)
        self.assertEqual(name_strength("SHEILA JACKSON LEE", PersonName("Sheila", "Jackson Lee")), 2)
        self.assertEqual(name_strength("SHEILA LEE", PersonName("Sheila", "Jackson Lee")), 0)
        self.assertEqual(name_strength("José Serrano", PersonName("Jose", "Serrano")), 2)
        self.assertEqual(name_strength("ANGUS S. KING, JR.", PersonName("Angus", "King", middle="S.")), 2)

    def test_display_names_split_into_first_and_last(self) -> None:
        self.assertEqual(person_from_display("Nathan Deal"), PersonName("Nathan", "Deal", official="Nathan Deal"))
        self.assertEqual(person_from_display("Bill Walker (American politician)").last, "Walker")
        self.assertEqual(person_from_display("Jim Justice Jr.").last, "Justice")

    def test_general_election_day_is_the_tuesday_after_the_first_monday(self) -> None:
        self.assertEqual(general_election_day(2026), date(2026, 11, 3))
        self.assertEqual(general_election_day(2022), date(2022, 11, 8))
        self.assertEqual(general_election_day(2015), date(2015, 11, 3))
        self.assertEqual(general_election_day(2020), date(2020, 11, 3))


class TurnoutAndPresidentTests(unittest.TestCase):
    def test_multi_year_file_keeps_states_and_leaves_missing_ballots_null(self) -> None:
        rows = parse_turnout(SAMPLES / "electionlab_1980_2022_sample.csv", None, "Election Lab 1980-2022")

        by_key = {(str(r.state), r.year): r for r in rows}
        self.assertNotIn("DC", {r.state for r in rows})
        self.assertEqual((by_key[("TX", 2022)].total_ballots, by_key[("TX", 2022)].vep), (8151590, 19523011))
        self.assertIsNone(by_key[("TX", 2008)].total_ballots)
        self.assertFalse(by_key[("TX", 2022)].unofficial)

    def test_single_year_file_takes_the_year_and_marks_estimates(self) -> None:
        rows = parse_turnout(SAMPLES / "electionlab_2026_sample.csv", 2026, "Election Lab 2026")

        tx = next(r for r in rows if r.state == "TX")
        self.assertEqual((tx.year, tx.total_ballots, tx.unofficial), (2026, 9975000, True))
        self.assertEqual(len(rows), 2)

    def test_turnout_file_missing_a_column_raises_naming_it(self) -> None:
        with self.assertRaisesRegex(SourceFormatError, "YEAR"):
            parse_turnout(SAMPLES / "electionlab_2024_sample.csv", None, "Election Lab 2024")

    def test_president_file_sums_states_by_party(self) -> None:
        rows = {(r.year, str(r.state)): r for r in parse_medsl_president(SAMPLES / "medsl_president_sample.csv")}

        pa = rows[(2024, "PA")]
        self.assertAlmostEqual(100.0 * (pa.dem - pa.rep) / pa.total, -1.7, delta=0.05)
        ga = rows[(2020, "GA")]
        self.assertAlmostEqual(100.0 * (ga.dem - ga.rep) / ga.total, 0.24, delta=0.01)
        self.assertNotIn((2024, "DC"), rows)
