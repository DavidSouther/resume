import unittest

from lib.names import normalize_name


class NormalizeNameTests(unittest.TestCase):
    def test_capitals_become_mixed_case_with_prefixes_and_initials(self) -> None:
        self.assertEqual(normalize_name("ETHAN A BERKOWITZ"), "Ethan A. Berkowitz")
        self.assertEqual(normalize_name("BETO O'ROURKE"), "Beto O'Rourke")
        self.assertEqual(normalize_name("MCDERMOTT, BOB"), "Bob McDermott")
        self.assertEqual(normalize_name("AGUILERA-MARRERO"), "Aguilera-Marrero")

    def test_last_comma_first_is_reordered_but_a_suffix_after_a_comma_is_not(self) -> None:
        self.assertEqual(normalize_name("CORTEZ MASTO, CATHERINE"), "Catherine Cortez Masto")
        self.assertEqual(normalize_name("ANGUS S. KING, JR."), "Angus S. King Jr.")
        self.assertEqual(normalize_name("FRANK PALLONE, JR"), "Frank Pallone Jr.")
        self.assertEqual(normalize_name("JOHN SMITH III"), "John Smith III")

    def test_mangled_nickname_quotes_are_repaired(self) -> None:
        self.assertEqual(normalize_name("HENRY C â\u0080\u009cHANKâ\u0080\u009d JOHNSON, JR"), 'Henry C. "Hank" Johnson Jr.')
        self.assertEqual(normalize_name('\\LUKE\\" MIXON"'), '"Luke" Mixon')

    def test_mixed_case_names_keep_their_capitals(self) -> None:
        self.assertEqual(normalize_name("Sean Parnell"), "Sean Parnell")
        self.assertEqual(normalize_name("Ethan A. Berkowitz"), "Ethan A. Berkowitz")
        self.assertEqual(normalize_name("  Larry   Hogan Jr. "), "Larry Hogan Jr.")
        self.assertEqual(normalize_name(""), "")

    def test_accented_capitals_are_lowered_too(self) -> None:
        self.assertEqual(normalize_name('JESÚS G. "CHUY" GARCÍA'), 'Jesús G. "Chuy" García')
