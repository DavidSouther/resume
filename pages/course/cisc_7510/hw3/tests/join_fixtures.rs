//! End to end: run the `csv_join` binary over every case in `tests/data` for
//! each join type, and compare its output file with `expected.csv`.
//!
//! `expected.csv` is in LOOP order, so LOOP compares bytes exactly. HASH and
//! MERGE may emit another order, so they compare sorted lines. MERGE also
//! needs inputs sorted on the key, so it runs only the cases that are.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

/// `--max-memory` values to run each case at. Output must not depend on the
/// budget; the smallest one forces every A row into its own batch.
const BUDGETS: [Option<&str>; 2] = [None, Some("1")];

fn cases() -> Vec<PathBuf> {
    let data = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/data");
    let mut cases: Vec<_> = fs::read_dir(&data)
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| p.is_dir())
        .collect();
    cases.sort();
    assert!(cases.len() >= 14, "expected fixture cases in {data:?}");
    cases
}

fn name(case: &Path) -> &str {
    case.file_name().unwrap().to_str().unwrap()
}

fn run(join_type: &str, case: &Path, budget: Option<&str>) -> String {
    let out = Path::new(env!("CARGO_TARGET_TMPDIR")).join(format!(
        "{join_type}-{}-{}.csv",
        name(case),
        budget.unwrap_or("default")
    ));
    let mut command = Command::new(env!("CARGO_BIN_EXE_csv_join"));
    command
        .arg("--join-type")
        .arg(join_type)
        .arg("--out")
        .arg(&out)
        .arg(case.join("a.csv"))
        .arg(case.join("b.csv"));
    if let Some(budget) = budget {
        command.arg("--max-memory").arg(budget);
    }
    let result = command.output().unwrap();
    assert!(
        result.status.success(),
        "{join_type} {} at {budget:?} failed: {}",
        name(case),
        String::from_utf8_lossy(&result.stderr)
    );
    fs::read_to_string(&out).unwrap()
}

fn expected(case: &Path) -> String {
    fs::read_to_string(case.join("expected.csv")).unwrap()
}

fn sorted(output: &str) -> Vec<&str> {
    let mut lines: Vec<_> = output.lines().collect();
    lines.sort();
    lines
}

fn sorted_on_key(file: &Path) -> bool {
    let rows = fs::read_to_string(file).unwrap();
    let keys: Vec<_> = rows.lines().map(|r| r.split(',').next().unwrap()).collect();
    keys.is_sorted()
}

#[test]
fn loop_joins_every_case() {
    for case in cases() {
        for budget in BUDGETS {
            assert_eq!(
                run("loop", &case, budget),
                expected(&case),
                "case {} at {budget:?}",
                name(&case)
            );
        }
    }
}

#[test]
#[ignore = "HASH join is not implemented"]
fn hash_joins_every_case() {
    for case in cases() {
        for budget in BUDGETS {
            let output = run("hash", &case, budget);
            assert_eq!(
                sorted(&output),
                sorted(&expected(&case)),
                "case {} at {budget:?}",
                name(&case)
            );
        }
    }
}

#[test]
#[ignore = "MERGE join is not implemented"]
fn merge_joins_every_sorted_case() {
    let cases: Vec<_> = cases()
        .into_iter()
        .filter(|c| sorted_on_key(&c.join("a.csv")) && sorted_on_key(&c.join("b.csv")))
        .collect();
    assert!(!cases.is_empty(), "no fixture case has sorted inputs");
    for case in cases {
        for budget in BUDGETS {
            let output = run("merge", &case, budget);
            assert_eq!(
                sorted(&output),
                sorted(&expected(&case)),
                "case {} at {budget:?}",
                name(&case)
            );
        }
    }
}
