"""Feature test: the grid/ghost pipeline finds exactly the brute-force violators.

Run: python3 -m unittest pages/course/cisc_7510/hw9/test_flying.py  (or `python3 test_flying.py` here)
"""
import os
import subprocess
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
FLYING = os.path.join(HERE, "flying.py")


def run(stage, stdin, *args):
    return subprocess.run(
        ["python3", FLYING, stage, *args], input=stdin, capture_output=True, text=True, check=True
    ).stdout


def shuffle_sort(text):
    """Stand-in for the Hadoop shuffle: stable sort on the first tab-separated field."""
    lines = text.splitlines()
    return "".join(l + "\n" for l in sorted(lines, key=lambda l: l.split("\t")[0]))


def pipeline(data, *args):
    pairs = run("cell", shuffle_sort(run("map", data, *args)), *args)
    runs = run("runs", shuffle_sort(pairs), *args)
    return set(run("distinct", "".join(sorted(run("vins", runs).splitlines(True)))).split())


class FlyingCars(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = run("gen", "", "--cars", "150")
        cls.expected = set(run("brute", cls.data).split())

    def test_brute_force_matches_planted_scenarios(self):
        planted = {v for v in self.expected if not v.startswith("R")}
        self.assertEqual(
            planted,
            {"P1a", "P1b", "P4a", "P4b", "P5a", "P5b", "P8a", "P8b", "P8c", "P9a", "P9b", "P10a", "P10b", "P7a", "P7b"},
        )

    def test_grid_pipeline_equals_brute_force(self):
        self.assertEqual(pipeline(self.data), self.expected)

    def test_other_cell_sizes_agree(self):
        for k in ("2", "3", "8"):
            with self.subTest(k=k):
                self.assertEqual(pipeline(self.data, "--k", k), self.expected)

    def test_airborne_modes_match_brute_force(self):
        for mode, extra in (("any", {"P12a", "P12b"}), ("off", {"P12a", "P12b", "P3a", "P3b"})):
            with self.subTest(mode=mode):
                expected = set(run("brute", self.data, "--airborne", mode).split())
                self.assertTrue(extra <= expected)
                self.assertEqual(pipeline(self.data, "--airborne", mode), expected)

    def test_far_coordinates_do_not_collide(self):
        # Adjacent cells used to alias when a coordinate exceeded the packed range.
        rows = []
        for tick in range(102):
            for vin, x in (("a", 49), ("b", 51)):
                rows.append(f"{vin},{tick * 10},{x},52428820,20\n")
        self.assertEqual(pipeline("".join(rows)), {"a", "b"})

    def test_gap_tolerant_stride_cannot_hide_all_sampled_ticks(self):
        rows = []
        for tick in range(103):
            rows.append(f"a,{tick * 10},0,0,20\n")
            x = 100 if tick % 10 == 0 else 5
            rows.append(f"b,{tick * 10},{x},0,20\n")
        data = "".join(rows)
        self.assertEqual(pipeline(data), {"a", "b"})
        self.assertEqual(pipeline(data, "--stride", "10"), {"a", "b"})

    def test_large_stride_cannot_skip_a_whole_run(self):
        data = "".join(f"{vin},{tick * 10},{x},0,20\n" for tick in range(1, 103)
                       for vin, x in (("a", 0), ("b", 5)))
        self.assertEqual(pipeline(data, "--gap", "0", "--stride", "200"), {"a", "b"})

    def test_stride_candidates_then_verify(self):
        expected = set(run("brute", self.data, "--gap", "0").split())
        candidates = pipeline(self.data, "--stride", "10", "--gap", "0")
        self.assertTrue(expected <= candidates)
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
            f.write("\n".join(sorted(candidates)))
        try:
            self.assertEqual(pipeline(self.data, "--vins", f.name, "--gap", "0"), expected)
        finally:
            os.unlink(f.name)


if __name__ == "__main__":
    unittest.main()
