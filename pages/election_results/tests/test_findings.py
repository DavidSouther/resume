import contextlib
import hashlib
import io
import json
import re
import shutil
import tempfile
import unittest
from pathlib import Path
from typing import Any
from unittest import mock

import analyze
import findings
from findings import build_findings, counts_2026, describe_inputs, load_inputs, validate, write_atomic
from lib import findings_format as fmt
from lib import findings_rules as rules
from lib.ap import RaceProgress
from tests.test_analyze import Fixture, race

SAMPLES = Path(__file__).parent / "samples"
TOOLS: dict[str, Any] = {"python": "3", "duckdb": "1", "numpy": "2", "jsonschema": "4", "findings_py_sha256": "0" * 64, "commit": None}
RACE_KEY = re.compile(r"^\d{4}:[A-Z]{2}:(house|senate|governor):\d+(:special)?$")


def ap_race(seat: int, d: int, r: int, **extra: Any) -> dict[str, Any]:
    return race(2026, "TX", "house", seat, d, r, source="ap", unofficial=True, **extra)


class FixtureOut:
    """A pulled and analyzed out/ with six 2026 Texas House races from AP and their 2024 priors, and a cache with the AP samples."""

    def __init__(self, test: unittest.TestCase) -> None:
        races = [race(2024, "TX", "house", s, 100, 120) for s in range(21, 27)] + [ap_race(s, 130, 110) for s in range(21, 27)]
        self.fixture = Fixture(races)
        self.fixture.con.close()
        test.addCleanup(self.fixture.tmp.cleanup)
        self.out = self.fixture.out
        self.data = self.fixture.data
        self.cache = self.out.parent / "cache"
        ap = self.cache / "ap" / "2026-11-03"
        ap.mkdir(parents=True)
        shutil.copy(SAMPLES / "ap_2026_metadata.json", ap / "metadata.json")
        shutil.copy(SAMPLES / "ap_2026_progress.json", ap / "progress.json")
        with contextlib.redirect_stdout(io.StringIO()):
            analyze.main(["--out", str(self.out), "--data", str(self.fixture.data)])
        (self.data / "load_report.txt").write_text("Load report, written 2026-11-06T04:17:23Z\n\nNothing skipped.\n")

    def run(self, *argv: str) -> tuple[int, str, str]:
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            status = findings.main(["--out", str(self.out), "--cache", str(self.cache), "--data", str(self.data), *argv])
        return status, stdout.getvalue(), stderr.getvalue()


class LoadInputsTest(unittest.TestCase):
    def test_inputs_are_hashed_and_relative_to_the_script_folder(self) -> None:
        out = FixtureOut(self)

        listed = describe_inputs(load_inputs(out.data, out.out, out.cache))

        entry = next(i for i in listed if i["path"].endswith("races.csv"))
        self.assertEqual(entry["sha256"], hashlib.sha256((out.data / "races.csv").read_bytes()).hexdigest())
        self.assertEqual(entry["rows"], 12)
        for i in listed:
            path = findings.HERE / i["path"]
            self.assertEqual(i["sha256"], hashlib.sha256(path.read_bytes()).hexdigest(), i["path"])
            self.assertEqual(i["bytes"], path.stat().st_size)
        self.assertTrue(any(i["path"].endswith("ap/2026-11-03/progress.json") for i in listed))
        self.assertEqual(len(listed), 14)

    def test_missing_answer_exits_1_and_writes_nothing(self) -> None:
        out = FixtureOut(self)
        (out.data / "answers" / "seat_change_2026.csv").unlink()

        status, _, err = out.run()

        self.assertEqual(status, 1)
        self.assertIn("seat_change_2026.csv", err)
        self.assertIn("uv run analyze.py --data", err)
        self.assertFalse((out.out / "findings.json").exists())

    def test_missing_progress_cache_counts_unknown_eevp(self) -> None:
        out = FixtureOut(self)
        shutil.rmtree(out.cache / "ap")

        f = build_findings(load_inputs(out.data, out.out, out.cache), TOOLS)

        self.assertEqual(f["run"]["counts_2026"]["house"]["eevp_unknown"], 6)
        self.assertEqual(f["selectors"]["completeness"], "counting_in_progress")
        self.assertEqual(validate(f), [])


class RunTest(unittest.TestCase):
    def test_writes_a_valid_file_and_prints_each_selector(self) -> None:
        out = FixtureOut(self)

        status, printed, err = out.run()

        self.assertEqual(status, 0, err)
        f = json.loads((out.out / "findings.json").read_text())
        self.assertEqual(validate(f), [])
        self.assertEqual(list(f["selectors"]), rules.selector_keys())
        self.assertIn("completeness: counting_in_progress", printed)
        self.assertEqual(len(printed.splitlines()), 72)
        self.assertEqual(sorted(f["run"]["counts_2026"]), ["governor", "house", "senate"])
        self.assertEqual(f["thresholds"]["k_parity_band"], [0.98, 1.02])
        self.assertFalse(list(out.out.glob(".*partial")))

    def test_evidence_race_keys_exist_in_races_csv(self) -> None:
        out = FixtureOut(self)
        f = build_findings(load_inputs(out.data, out.out, out.cache), TOOLS)
        known = {rules.race_key(r) for r in load_inputs(out.data, out.out, out.cache).races}

        keys = [e for c in f["claims"].values() for e in c["evidence"] if ":" in e and ".csv:" not in e]

        self.assertTrue(keys)
        for key in keys:
            self.assertRegex(key, RACE_KEY)
            self.assertIn(key, known)
        self.assertIn("2026:TX:house:21", f["claims"]["seat_shift.house"]["evidence"])
        self.assertIn("2026:TX:house:21", f["claims"]["completeness"]["evidence"])
        self.assertNotIn("2026:TX:house:26", f["claims"]["completeness"]["evidence"])  # eevp 99 in the sample

    def test_failed_validation_leaves_the_earlier_file_untouched(self) -> None:
        out = FixtureOut(self)
        earlier = b'{"earlier": true}\n'
        (out.out / "findings.json").write_bytes(earlier)

        with mock.patch.object(findings, "validate", return_value=["selectors: broken"]):
            status, _, err = out.run()

        self.assertEqual(status, 1)
        self.assertIn("broken", err)
        self.assertEqual((out.out / "findings.json").read_bytes(), earlier)


class CheckTest(unittest.TestCase):
    def test_check_accepts_a_valid_file_and_rejects_an_unknown_value(self) -> None:
        out = FixtureOut(self)
        out.run()
        path = out.out / "findings.json"
        bad = json.loads(path.read_text())
        bad["selectors"]["seat_shift.house"] = "landslide"
        bad["claims"]["seat_shift.house"]["value"] = "landslide"
        bad_path = out.out / "bad.json"
        bad_path.write_text(json.dumps(bad))
        before = bad_path.read_bytes()

        good_status, _, _ = out.run("--check", str(path))
        bad_status, _, err = out.run("--check", str(bad_path))

        self.assertEqual(good_status, 0)
        self.assertEqual(bad_status, 1)
        self.assertIn("landslide", err)
        self.assertEqual(bad_path.read_bytes(), before)

    def test_validate_names_a_missing_key_and_a_mismatched_claim(self) -> None:
        out = FixtureOut(self)
        f = build_findings(load_inputs(out.data, out.out, out.cache), TOOLS)
        f["claims"]["k_direction.house"]["value"] = "near_parity" if f["selectors"]["k_direction.house"] != "near_parity" else "insufficient_data"
        del f["selectors"]["completeness"]

        problems = validate(f)

        self.assertTrue(any("completeness" in p for p in problems))
        self.assertTrue(any("k_direction.house" in p for p in problems))

    def test_schema_version_999_is_invalid(self) -> None:
        out = FixtureOut(self)
        f = build_findings(load_inputs(out.data, out.out, out.cache), TOOLS)

        self.assertTrue(validate({**f, "schema_version": 999}))


class Counts2026Test(unittest.TestCase):
    def rows(self, n: int, source: str = "ap", unofficial: bool = True) -> list[dict[str, str]]:
        return [{"year": "2026", "state": "TX", "office": "house", "seat": str(s), "special": "false", "source": source, "official": "false" if unofficial else "true"} for s in range(1, n + 1)]

    def progress(self, *eevps: float | None) -> dict[str, RaceProgress]:
        return {f"2026:TX:house:{i + 1}": RaceProgress(e, "2026-11-05T15:28:06Z") for i, e in enumerate(eevps)}

    def completeness(self, races: list[dict[str, str]], progress: dict[str, RaceProgress]) -> str:
        return rules.completeness(counts_2026(races, progress), "t")["value"]

    def test_each_completeness_value(self) -> None:
        self.assertEqual(self.completeness(self.rows(3, source="Wikipedia"), {}), "no_2026_data")
        self.assertEqual(self.completeness(self.rows(3, unofficial=False), self.progress(50, 50, 50)), "certified")
        self.assertEqual(self.completeness(self.rows(3), self.progress(95, 99, 100)), "counting_nearly_complete")
        self.assertEqual(self.completeness(self.rows(3), self.progress(94.9, 99, 100)), "counting_in_progress")
        self.assertEqual(self.completeness(self.rows(3), self.progress(99, 99)), "counting_in_progress")

    def test_counts(self) -> None:
        counts = counts_2026(self.rows(3), self.progress(80, 99, 100))["house"]

        self.assertEqual(counts["ap_races"], 3)
        self.assertEqual(counts["eevp_below_100"], 2)
        self.assertEqual(counts["eevp_below_95"], 1)
        self.assertEqual(counts["eevp_min"], 80)
        self.assertEqual(counts["eevp_median"], 99)
        self.assertEqual(counts["latest_update"], "2026-11-05T15:28:06Z")


class QuestionsTest(unittest.TestCase):
    def test_sql_text_is_verbatim_and_hashed(self) -> None:
        sql = findings.question_sql()

        entry = next(e for e in sql["seat_change"] if e["file"] == "sql/20_seat_change_2026.sql")
        on_disk = (findings.HERE / "sql" / "20_seat_change_2026.sql").read_bytes()
        self.assertEqual(entry["text"].encode("utf-8"), on_disk)
        self.assertEqual(entry["sha256"], hashlib.sha256(on_disk).hexdigest())
        fit = next(e for e in sql["incumbency"] if e["file"] == "analyze.py:fit_incumbency")
        self.assertEqual(fit["kind"], "python")
        self.assertTrue(fit["text"].startswith("def fit_incumbency("))
        self.assertEqual(sorted(sql), ["dummymander", "incumbency", "seat_change", "turnout"])

    def test_raw_results_are_capped_with_the_total(self) -> None:
        out = FixtureOut(self)

        raw = findings.raw_results(load_inputs(out.data, out.out, out.cache), cap=4)

        table = raw["seat_change"][0]
        self.assertEqual(table["total_rows"], 6)
        self.assertEqual(len(table["rows"]), 4)
        self.assertTrue(table["truncated"])
        self.assertEqual(table["columns"][0], "year")
        self.assertTrue(all(len(r) == len(table["columns"]) for r in table["rows"]))


class CellFormatTest(unittest.TestCase):
    def test_raw_cells_round_by_column(self) -> None:
        self.assertEqual(fmt.raw_cell("margin_change", "-2.4471331009240482"), f"{fmt.MINUS}2.45")
        self.assertEqual(fmt.raw_cell("k", "1.796089792747034"), "1.796")
        self.assertEqual(fmt.raw_cell("flip_share", "-0.017950029824645386"), f"{fmt.MINUS}0.018")
        self.assertEqual(fmt.raw_cell("d0", "185296"), "185,296")
        self.assertEqual(fmt.raw_cell("required_extra_dem_votes", "-10516.2"), f"{fmt.MINUS}10,516")
        self.assertEqual(fmt.raw_cell("wald_p", "0.07744394681712256"), "0.0774")
        self.assertEqual(fmt.raw_cell("wald_p", "1.2e-05"), "0.0000120")
        self.assertEqual(fmt.raw_cell("state", "AK"), "AK")
        self.assertEqual(fmt.raw_cell("year", "2026"), "2026")
        self.assertEqual(fmt.raw_cell("k", ""), "")

    def test_claim_cells_have_fixed_precision_and_nulls(self) -> None:
        claim = findings.with_cells({"value": "x", "rule": "r", "numbers": {"n": 5, "median_margin_change": 1.0, "share_toward_dem": None}, "display": {}, "trigger_fields": [], "evidence": []})

        self.assertEqual(claim.get("cells"), {"n": "5", "median_margin_change": "+1.00", "share_toward_dem": None})

    def test_raw_results_mark_numeric_columns(self) -> None:
        out = FixtureOut(self)

        table = findings.raw_results(load_inputs(out.data, out.out, out.cache))["turnout"][0]

        kinds = dict(zip(table["columns"], table["column_kinds"], strict=True))
        units = dict(zip(table["columns"], table["column_units"], strict=True))
        self.assertEqual((kinds["k"], units["k"]), ("number", "ratio"))
        self.assertEqual((kinds["state"], units["state"]), ("text", ""))


class WriteAtomicTest(unittest.TestCase):
    def test_replaces_the_file_and_leaves_no_partial(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "findings.json"
            path.write_text("old")

            write_atomic(path, {"a": "caf\u00e9"})

            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), {"a": "caf\u00e9"})
            self.assertEqual(sorted(p.name for p in Path(tmp).iterdir()), ["findings.json"])


if __name__ == "__main__":
    unittest.main()
