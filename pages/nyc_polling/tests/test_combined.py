import itertools
import unittest

from nyc_tracts.kernel.poverty import CLASSES, MISSING_COLOR
from nyc_tracts.presentation.bands import BANDS
from nyc_tracts.presentation.combined import COMBINED, cells, combined_fill


class CombinedFill(unittest.TestCase):
    def test_every_class_and_band_has_its_own_color(self) -> None:
        self.assertEqual((len(COMBINED), {len(r) for r in COMBINED}), (len(CLASSES), {len(BANDS)}))
        self.assertEqual(len({c for row in COMBINED for c in row}), len(CLASSES) * len(BANDS))

    def test_fill_looks_up_class_then_band(self) -> None:
        self.assertEqual(combined_fill(5.0, 0), COMBINED[0][0])
        self.assertEqual(combined_fill(45.0, 3), COMBINED[4][3])
        self.assertEqual((combined_fill(9.9, 1), combined_fill(10.0, 1), combined_fill(39.9, 2), combined_fill(40.0, 2)), (COMBINED[0][1], COMBINED[1][1], COMBINED[3][2], COMBINED[4][2]))

    def test_no_rate_is_no_data(self) -> None:
        self.assertEqual(combined_fill(None, 3), MISSING_COLOR)

    def test_poverty_darkens_down_each_column(self) -> None:
        def luma(h: str) -> float:
            r, g, b = (int(h[i : i + 2], 16) for i in (1, 3, 5))
            return 0.2126 * r + 0.7152 * g + 0.0722 * b

        for j in range(len(BANDS)):
            col = [luma(COMBINED[i][j]) for i in range(len(CLASSES))]
            self.assertEqual(col, sorted(col, reverse=True), f"distance band {j}")

    def test_cells_are_labelled_row_major(self) -> None:
        got = cells()

        self.assertEqual((got[0], got[-1]), (("#baccff", "Under 10%, within 1/4 mile"), ("#6c0021", "40% and over, over 1 mile")))
        self.assertEqual(len(list(itertools.chain(got))), 20)


if __name__ == "__main__":
    unittest.main()
