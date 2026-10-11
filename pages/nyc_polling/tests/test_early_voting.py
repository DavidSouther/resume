import unittest

from nyc_tracts.domain import Site
from nyc_tracts.early_voting import EdAssignment, normalize_address, parse_county, sites_by_assignment, split_site


def word(x0: float, y0: float, text: str) -> str:
    return f'<word xMin="{x0}" yMin="{y0}" xMax="{x0 + 20}" yMax="{y0 + 10}">{text}</word>'


def synthetic_county() -> str:
    """Two blocks of ED / SITE NAME / SITE ADDRESS columns, each with an Assembly District label."""
    parts = [
        word(100, 20, "23") + word(110, 20, "rd") + word(120, 20, "Assembly") + word(140, 20, "District"),
        word(400, 20, "24") + word(410, 20, "th") + word(420, 20, "Assembly") + word(440, 20, "District"),
        word(81, 40, "ED") + word(324, 40, "ED"),
        word(81, 60, "001") + word(110, 60, "ST. JOHN&apos;S......") + word(200, 60, "80-00 UTOPIA PKWY"),
        word(324, 60, "001") + word(350, 60, "JADE EVENTS SPACE....") + word(450, 60, "431 BEACH 129 STREET"),
        word(81, 80, "002") + word(110, 80, "JADE EVENTS SPACE....") + word(200, 80, "431 BEACH 129 STREET"),
    ]
    return "<page>" + "".join(parts) + "</page>"


class Parse(unittest.TestCase):
    def test_split_site_at_the_dot_leader(self) -> None:
        self.assertEqual(split_site("ST. FRANCES DE CHANTAL CHURCH. ....190 HOLLYWOOD AVE"), ("ST. FRANCES DE CHANTAL CHURCH", "190 HOLLYWOOD AVE"))
        self.assertEqual(split_site("MS 390 (PS 26).......................... 1930 ANDREWS AVENUE SOUTH"), ("MS 390 (PS 26)", "1930 ANDREWS AVENUE SOUTH"))
        self.assertIsNone(split_site("NO LEADER HERE"))

    def test_rows_take_their_district_from_the_label_over_their_column(self) -> None:
        assignments, problems = parse_county(synthetic_county(), "Queens")

        self.assertEqual(problems, [])
        self.assertEqual(
            sorted((a.elect_dist, a.site_address) for a in assignments),
            [(23001, "80-00 UTOPIA PKWY"), (23002, "431 BEACH 129 STREET"), (24001, "431 BEACH 129 STREET")],
        )


class Matching(unittest.TestCase):
    def test_normalize_spells_out_abbreviations_and_drops_suffixes(self) -> None:
        self.assertEqual(normalize_address("1833 LEX AVE"), normalize_address("1833 Lexington Avenue"))
        self.assertEqual(normalize_address("258 West 115th Street"), normalize_address("258 W 115 ST"))
        self.assertEqual(normalize_address("2-07 Beach 73 Street"), normalize_address("207 BEACH 73 ST"))

    def test_unmatched_address_fails_loudly(self) -> None:
        assignments = [EdAssignment("Bronx", 77, 1, "A SCHOOL", "1 NOWHERE ROAD")]

        with self.assertRaisesRegex(RuntimeError, "NOWHERE"):
            sites_by_assignment(assignments, [Site("2 Elsewhere Road", -73.9, 40.8)])
