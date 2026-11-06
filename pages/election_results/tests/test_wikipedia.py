import json
import unittest
from pathlib import Path
from typing import Any

from lib.model import CandidateRow, SourceFormatError
from lib.wikipedia import clean, election_boxes, governor_incumbent, governor_titles, house_titles, parse_2026_page, parse_governor_page, party_of

SAMPLES = Path(__file__).parent / "samples"
AT = "2026-11-05T00:00Z"


def load_sample(name: str) -> dict[str, Any]:
    payload: dict[str, Any] = json.loads((SAMPLES / name).read_text())
    return payload


def page(title: str, wikitext: str) -> dict[str, Any]:
    return {"parse": {"title": title, "pageid": 1, "revid": 2, "wikitext": wikitext}}


def find(rows: list[CandidateRow], text: str) -> CandidateRow:
    hits = [r for r in rows if text in r.candidate]
    if len(hits) != 1:
        raise AssertionError(f"{len(hits)} rows for {text}")
    return hits[0]


GENERAL_BOX = """
==General election==
===Results===
{{Election box begin | title=2018 Georgia gubernatorial election<ref>{{cite web|title=Official}}</ref>}}
{{Election box winning candidate with party link|
  |party      = Republican Party (United States)
  |candidate  = [[Brian Kemp]]
  |votes      = {{formatnum:1978408}}<ref name="sos"/>{{efn|Certified total.}}
  |percentage = 50.22%
}}
{{Election box candidate with party link|
  |party      = Democratic Party (United States)
  |candidate  = '''[[Stacey Abrams|Stacey Abrams]]'''
  |votes      = 1,923,685<ref>{{cite web|title=x}}</ref>
}}
{{Election box write-in with party link|
  |votes      = 81
}}
{{Election box total
  |votes      = 3,902,174
}}
{{Election box end}}
"""


class GovernorPageTests(unittest.TestCase):
    def test_governor_page_parses_georgia_2018(self) -> None:
        rows, skipped = parse_governor_page(load_sample("wiki_gov_2018_ga.json"), 2018, AT)

        kemp = find(rows, "Kemp")

        self.assertEqual((kemp.state, kemp.office, kemp.seat, kemp.party, kemp.round, kemp.votes), ("GA", "governor", 0, "REP", "general", 1978408))
        self.assertAlmostEqual(kemp.pct or 0.0, 50.2, delta=0.1)
        self.assertEqual(find(rows, "Abrams").party, "DEM")
        self.assertEqual({r.round for r in rows}, {"general"})  # the primary runoff box is not a general runoff
        self.assertEqual((skipped, kemp.unofficial, kemp.fetched_at), ([], False, AT))
        self.assertIn("2018 Georgia gubernatorial election", kemp.source)

    def test_footnoted_vote_counts_with_separators_parse_to_integers(self) -> None:
        rows, _ = parse_governor_page(page("2018 Georgia gubernatorial election", GENERAL_BOX), 2018, AT)

        self.assertEqual([(r.candidate, r.votes) for r in rows], [("Brian Kemp", 1978408), ("Stacey Abrams", 1923685), ("Write-in", 81)])
        self.assertEqual({r.total_votes for r in rows}, {1978408 + 1923685 + 81})

    def test_independent_governor_without_caucus_is_other(self) -> None:
        rows, _ = parse_governor_page(load_sample("wiki_gov_2014_ak.json"), 2014, AT)

        walker = find(rows, "Walker")

        self.assertEqual(walker.party, "OTHER")
        self.assertEqual(find(rows, "Parnell").party, "REP")
        self.assertTrue(find(rows, "Parnell").incumbent)

    def test_fusion_lines_sum_and_total_lines_add_nothing(self) -> None:
        rows, _ = parse_governor_page(load_sample("wiki_gov_2018_ny.json"), 2018, AT)

        cuomo = find(rows, "Cuomo")

        self.assertEqual((cuomo.party, cuomo.votes, cuomo.incumbent), ("DEM", 3635340, True))
        self.assertEqual(find(rows, "Molinaro").votes, 2207602)

    def test_louisiana_runoff_is_a_second_round(self) -> None:
        rows, _ = parse_governor_page(load_sample("wiki_gov_2015_la.json"), 2015, AT)

        runoff = {r.candidate: r for r in rows if r.round == "runoff"}

        self.assertEqual(len(runoff), 2)
        self.assertGreater(runoff["John Bel Edwards"].votes or 0, runoff["David Vitter"].votes or 0)
        self.assertGreater(len([r for r in rows if r.round == "general"]), 2)

    def test_unrecognized_layout_is_skipped_with_no_rows(self) -> None:
        text = GENERAL_BOX.replace("1,923,685", "TBD").replace("{{formatnum:1978408}}", "")

        rows, skipped = parse_governor_page(page("2018 Georgia gubernatorial election", text), 2018, AT)

        self.assertEqual(rows, [])
        self.assertEqual(len(skipped), 1)
        self.assertIn("2018 GA governor", skipped[0])

    def test_page_with_no_general_box_is_skipped(self) -> None:
        rows, skipped = parse_governor_page(page("2018 Georgia gubernatorial election", "==Results==\nA table we cannot read."), 2018, AT)

        self.assertEqual((rows, len(skipped)), ([], 1))

    def test_missing_page_raises_naming_the_api_error(self) -> None:
        payload: dict[str, Any] = {"error": {"code": "missingtitle", "info": "The page you specified doesn't exist."}}

        with self.assertRaises(SourceFormatError) as caught:
            parse_governor_page(payload, 2018, AT)

        self.assertIn("doesn't exist", str(caught.exception))

    def test_overview_lists_state_races_without_territories(self) -> None:
        titles = governor_titles(load_sample("wiki_govs_2018.json"), 2018)

        self.assertEqual(len(titles), 36)
        self.assertIn("2018 Georgia gubernatorial election", titles)
        self.assertNotIn("2018 Guamanian gubernatorial election", titles)
        self.assertEqual(governor_titles(load_sample("wiki_govs_2013.json"), 2013), ["2013 New Jersey gubernatorial election", "2013 Virginia gubernatorial election"])

    def test_page_without_a_general_box_falls_back_to_infobox_votes(self) -> None:
        text = (
            "{{Infobox election\n| nominee1 = '''[[Phil Bryant]]'''\n| party1 = Republican Party (United States)\n| popular_vote1 = 470,544\n"
            "| nominee2 = Robert Gray\n| party2 = Democratic Party (United States)\n| popular_vote2 = 234,858\n}}\n"
            "==Republican primary==\n{{Election box begin|title=Republican primary results}}\n"
            "{{Election box candidate with party link|party=Republican Party (United States)|candidate=Phil Bryant|votes=256,689}}\n{{Election box end}}"
        )

        rows, notes = parse_governor_page(page("2015 Mississippi gubernatorial election", text), 2015, AT)

        self.assertEqual([(r.candidate, r.party, r.votes, r.unofficial) for r in rows], [("Phil Bryant", "REP", 470544, False), ("Robert Gray", "DEM", 234858, False)])
        self.assertIn("partial, no general election box", notes[0])


class Page2026Tests(unittest.TestCase):
    def test_senate_page_reads_the_general_box_as_unofficial(self) -> None:
        rows, skipped = parse_2026_page(load_sample("wiki_sen_2026_tx.json"), "senate", AT)

        talarico = find(rows, "Talarico")

        self.assertEqual((talarico.year, talarico.state, talarico.seat, talarico.special, talarico.party), (2026, "TX", 2, False, "DEM"))
        self.assertEqual((talarico.votes, talarico.unofficial, skipped), (5445121, True, []))

    def test_special_without_box_votes_falls_back_to_the_infobox_and_is_noted(self) -> None:
        rows, notes = parse_2026_page(load_sample("wiki_sen_2026_oh.json"), "senate", AT)

        self.assertEqual({(r.candidate, r.party, r.votes) for r in rows}, {("Sherrod Brown", "DEM", 2301042), ("Jon Husted", "REP", 2077748)})
        self.assertEqual({(r.special, r.seat, r.unofficial) for r in rows}, {(True, 3, True)})
        self.assertEqual(len(notes), 1)
        self.assertIn("partial", notes[0])

    def test_infobox_nominee_without_votes_is_left_out_when_major_nominees_have_votes(self) -> None:
        text = (
            "{{Infobox election\n| nominee1 = Ashley Hinson\n| party1 = Republican Party (United States)\n| popular_vote1 = 700,000\n"
            "| nominee2 = Josh Turek\n| party2 = Democratic Party (United States)\n| popular_vote2 = 650,000\n"
            "| nominee3 = Thomas Laehn\n| party3 = Independent\n| popular_vote3 = \n}}\n"
        )

        rows, notes = parse_2026_page(page("2026 United States Senate election in Iowa", text), "senate", AT)

        self.assertEqual([(r.candidate, r.votes) for r in rows], [("Ashley Hinson", 700000), ("Josh Turek", 650000)])
        self.assertIn("partial", notes[0])

    def test_infobox_without_major_party_votes_is_skipped(self) -> None:
        text = "{{Infobox election\n| nominee1 = A\n| party1 = Republican Party (United States)\n| popular_vote1 = \n| nominee2 = B\n| party2 = Independent\n| popular_vote2 = 5\n}}\n"

        rows, skipped = parse_2026_page(page("2026 United States Senate election in Iowa", text), "senate", AT)

        self.assertEqual((rows, len(skipped)), ([], 1))

    def test_house_districts_without_votes_are_skipped_not_zero(self) -> None:
        rows, skipped = parse_2026_page(load_sample("wiki_house_2026_tx.json"), "house", AT)

        self.assertEqual(rows, [])
        self.assertEqual(sorted(skipped), ["2026 TX house district 1: the general election box has no votes for Nathaniel Moran, Yolanda Prince, Sonia Canciola",
                                           "2026 TX house district 2: the general election box has no votes for Steve Toth, Shaun Finnie"])  # fmt: skip

    def test_house_district_with_votes_reads_each_seat(self) -> None:
        text = """
==District 7==
===Democratic primary===
{{Election box begin|title=Democratic primary results}}
{{Election box candidate with party link|party=Democratic Party (United States)|candidate=A|votes=10}}
{{Election box end}}
===General election===
{{Election box begin|title=2026 Texas's 7th congressional district election}}
{{Election box winning candidate with party link|party=Democratic Party (United States)|candidate=[[Lizzie Fletcher]] (incumbent)|votes=150,000}}
{{Election box candidate with party link|party=Republican Party (United States)|candidate=B|votes=100,000}}
{{Election box end}}
"""
        rows, skipped = parse_2026_page(page("2026 United States House of Representatives elections in Texas", text), "house", AT)

        self.assertEqual(skipped, [])
        self.assertEqual([(r.seat, r.candidate, r.votes, r.incumbent) for r in rows], [(7, "Lizzie Fletcher", 150000, True), (7, "B.", 100000, False)])

    def test_house_titles_name_at_large_states_in_the_singular(self) -> None:
        titles = house_titles(2026)

        self.assertEqual(len(titles), 50)
        self.assertIn("2026 United States House of Representatives election in Wyoming", titles)
        self.assertIn("2026 United States House of Representatives elections in Texas", titles)


class MarkupTests(unittest.TestCase):
    def test_clean_unwraps_links_templates_and_refs(self) -> None:
        self.assertEqual(clean("'''[[Larry Sharpe (politician)|Larry Sharpe]]'''<ref name=a/> {{nowrap|(L)}}<!-- c -->"), "Larry Sharpe (L)")
        self.assertEqual(clean("{{sortname|Lisa|Murkowski}}"), "Lisa Murkowski")

    def test_joint_ticket_is_named_by_its_first_member(self) -> None:
        text = """==General election==
{{Election box begin|title=2011 Kentucky gubernatorial election}}
{{Election box winning candidate with party link|party=Democratic Party (United States)|candidate={{ubl|[[Steven L. Beshear]] (incumbent)|[[Jerry E. Abramson]]}}|votes=464,245}}
{{Election box candidate with party link|party=Republican Party (United States)|candidate=[[David L. Williams (politician)|David L. Williams]]<br />[[Richie Farmer]]|votes=294,034}}
{{Election box candidate with party link|party=Independent|candidate={{nowrap|[[Gatewood Galbraith]] / Dea Riley}}|votes=74,860}}
{{Election box end}}"""

        rows, _ = parse_governor_page(page("2011 Kentucky gubernatorial election", text), 2011, AT)

        self.assertEqual([(r.candidate, r.party, r.incumbent) for r in rows], [("Steven L. Beshear", "DEM", True), ("David L. Williams", "REP", False), ("Gatewood Galbraith", "OTHER", False)])

    def test_party_labels_map_to_major_parties(self) -> None:
        cases = {
            "Republican Party (United States)": "REP",
            "Democratic Party (United States)": "DEM",
            "Minnesota Democratic\u2013Farmer\u2013Labor Party": "DEM",
            "North Dakota Democratic\u2013Nonpartisan League Party": "DEM",
            "Independent politician": "OTHER",
            "Democratic Socialists of America": "OTHER",
            "Working Families Party": "OTHER",
        }
        self.assertEqual({label: party_of(label) for label in cases}, cases)

    def test_boxes_carry_their_section_headings(self) -> None:
        (box,) = election_boxes(GENERAL_BOX)

        self.assertEqual((box.title, box.headings, len(box.lines)), ("2018 Georgia gubernatorial election", ("General election", "Results"), 3))


class CandidateNoteTests(unittest.TestCase):
    def test_a_note_naming_the_incumbent_and_a_withdrawal_is_dropped_from_the_name_and_marks_the_incumbent(self) -> None:
        text = "{{Election box begin|title=General}}{{Election box candidate|party=Independent|candidate=[[Bill Walker]] (incumbent; withdrawn)|votes=2,000}}{{Election box end}}"

        (box,) = election_boxes(text)

        self.assertEqual((box.lines[0].candidate, box.lines[0].incumbent), ("Bill Walker", True))


class GovernorIncumbentTests(unittest.TestCase):
    def test_infobox_names_the_officeholder_and_party(self) -> None:
        self.assertEqual(governor_incumbent(load_sample("wiki_gov_2018_ga.json")), ((2018, "GA", False), "Nathan Deal", "REP"))
        self.assertEqual(governor_incumbent(load_sample("wiki_gov_2014_ak.json")), ((2014, "AK", False), "Sean Parnell", "REP"))

    def test_a_page_that_is_not_a_governor_race_has_none(self) -> None:
        self.assertIsNone(governor_incumbent(load_sample("wiki_sen_2026_oh.json")))


if __name__ == "__main__":
    unittest.main()
