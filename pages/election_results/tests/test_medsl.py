import shutil
import tempfile
import unittest
from pathlib import Path

from lib.medsl import parse_medsl
from lib.model import CandidateRow, SourceFormatError

SAMPLES = Path(__file__).parent / "samples"
AT = "2026-11-05T00:00Z"


def find(rows: list[CandidateRow], text: str, **match: object) -> CandidateRow:
    hits = [r for r in rows if text in r.candidate.upper() and all(getattr(r, k) == v for k, v in match.items())]
    if len(hits) != 1:
        raise AssertionError(f"{len(hits)} rows for {text} {match}")
    return hits[0]


class SenateTests(unittest.TestCase):
    def test_parse_medsl_maps_party_and_share(self) -> None:
        rows = parse_medsl(SAMPLES / "medsl_senate_sample.csv", "senate", AT)

        cruz = find(rows, "CRUZ", year=2018)

        self.assertEqual((cruz.party, cruz.votes, cruz.state, cruz.office, cruz.round), ("REP", 4260553, "TX", "senate", "general"))
        self.assertAlmostEqual(cruz.pct or 0.0, 50.9, delta=0.1)
        self.assertEqual((cruz.seat, cruz.special, cruz.fetched_at), (1, False, AT))

    def test_senate_fusion_lines_sum_under_the_major_party(self) -> None:
        rows = parse_medsl(SAMPLES / "medsl_senate_sample.csv", "senate", AT)

        gillibrand = find(rows, "GILLIBRAND", year=2018)

        self.assertEqual((gillibrand.party, gillibrand.votes), ("DEM", 3755489 + 160128 + 99325 + 41989))

    def test_january_runoff_is_stored_under_the_cycle_year_it_decided(self) -> None:
        rows = parse_medsl(SAMPLES / "medsl_senate_sample.csv", "senate", AT)

        ossoff = find(rows, "OSSOFF", round="runoff")

        self.assertEqual((ossoff.year, ossoff.special, ossoff.seat, ossoff.votes), (2020, False, 2, 2269262))
        self.assertEqual(find(rows, "WARNOCK", round="runoff").seat, 3)

    def test_special_elections_get_the_class_of_the_vacant_seat(self) -> None:
        rows = parse_medsl(SAMPLES / "medsl_senate_sample.csv", "senate", AT)

        self.assertEqual(find(rows, "COONS", year=2010).seat, 2)
        self.assertEqual(find(rows, "SCHATZ", year=2014).seat, 3)

    def test_missing_party_simplified_names_the_source_and_column(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            broken = Path(tmp) / "senate.csv"
            lines = (SAMPLES / "medsl_senate_sample.csv").read_text().splitlines()
            broken.write_text("\n".join([lines[0].replace(",party_simplified", ",party_other"), *lines[1:]]) + "\n")

            with self.assertRaises(SourceFormatError) as caught:
                parse_medsl(broken, "senate", AT)

        self.assertIn("senate.csv", str(caught.exception))
        self.assertIn("party_simplified", str(caught.exception))


class HouseTests(unittest.TestCase):
    def test_new_york_fusion_ticket_sums_into_one_row_under_the_major_party(self) -> None:
        rows = parse_medsl(SAMPLES / "medsl_house_wrapped.tab", "house", AT)

        zeldin = find(rows, "ZELDIN", year=2018)
        gershon = find(rows, "GERSHON", year=2018)

        self.assertEqual((zeldin.party, zeldin.votes, zeldin.seat), ("REP", 121562 + 14284 + 2693 + 488, 1))
        self.assertEqual((gershon.party, gershon.votes), ("DEM", 124213 + 3778))

    def test_wrapped_rows_parse_to_the_same_rows_as_an_unwrapped_copy(self) -> None:
        wrapped = parse_medsl(SAMPLES / "medsl_house_wrapped.tab", "house", AT, min_year=1976)
        plain = parse_medsl(SAMPLES / "medsl_house_unwrapped.csv", "house", AT, min_year=1976)

        self.assertEqual([r.__dict__ | {"source": ""} for r in wrapped], [r.__dict__ | {"source": ""} for r in plain])
        self.assertIn('William L. "Bill" Dickinson', {r.candidate for r in wrapped})
        self.assertIn('Charles "Charlie" Everette Holt Jr.', {r.candidate for r in wrapped})

    def test_at_large_district_is_seat_zero_and_years_before_min_are_dropped(self) -> None:
        rows = parse_medsl(SAMPLES / "medsl_house_wrapped.tab", "house", AT)

        self.assertEqual({r.seat for r in rows if r.state == "WY"}, {0})
        self.assertGreaterEqual(min(r.year for r in rows), 2008)

    def test_missing_party_column_in_house_file_raises(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            broken = Path(tmp) / "house.tab"
            shutil.copy(SAMPLES / "medsl_house_wrapped.tab", broken)
            text = broken.read_text().replace(",party,", ",partyx,", 1)
            broken.write_text(text)

            with self.assertRaises(SourceFormatError) as caught:
                parse_medsl(broken, "house", AT)

        self.assertIn("'party'", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
