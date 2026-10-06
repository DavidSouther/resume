//! End to end: run the `csv_join` binary over every case in `tests/data` for
//! each join type, and compare its output file with `expected.csv`.
//!
//! Every join type emits A's order, then B's order within each A row, so all
//! compare exactly. MERGE needs inputs sorted on the key, so this only runs
//! cases matching that invariant.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

const JOIN_TYPES: [&str; 3] = ["loop", "hash", "merge"];

/// `--max-memory` values for each run. Output must not depend on the
/// budget.
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

fn name(path: &Path) -> &str {
    path.file_name().unwrap().to_str().unwrap()
}

/// Run the binary, returning its process output and the joined rows.
fn run(join_type: &str, a: &Path, b: &Path, budget: Option<&str>) -> (Output, String) {
    let dir = a.parent().unwrap();
    let out = Path::new(env!("CARGO_TARGET_TMPDIR")).join(format!(
        "{join_type}-{}-{}.csv",
        name(dir),
        budget.unwrap_or("default")
    ));
    let mut command = Command::new(env!("CARGO_BIN_EXE_csv_join"));
    command
        .arg("--join-type")
        .arg(join_type)
        .arg("--out")
        .arg(&out)
        .arg(a)
        .arg(b);
    if let Some(budget) = budget {
        command.arg("--max-memory").arg(budget);
    }
    let result = command.output().unwrap();
    (result, fs::read_to_string(&out).unwrap())
}

fn sorted_on_key(file: &Path) -> bool {
    let rows = fs::read_to_string(file).unwrap();
    let keys: Vec<_> = rows.lines().map(|r| r.split(',').next().unwrap()).collect();
    keys.is_sorted()
}

#[test]
fn every_join_type_joins_every_case_it_accepts() {
    for case in cases() {
        let (a, b) = (case.join("a.csv"), case.join("b.csv"));
        let expected = fs::read_to_string(case.join("expected.csv")).unwrap();
        let sorted = sorted_on_key(&a) && sorted_on_key(&b);
        for join_type in JOIN_TYPES {
            if join_type == "merge" && !sorted {
                continue;
            }
            for budget in BUDGETS {
                let (result, output) = run(join_type, &a, &b, budget);
                let label = format!("{join_type} {} at {budget:?}", name(&case));
                assert!(
                    result.status.success(),
                    "{label} failed: {}",
                    String::from_utf8_lossy(&result.stderr)
                );
                assert_eq!(output, expected, "{label}");
            }
        }
    }
}

#[test]
fn sort_merge_joins_every_case_in_key_order() {
    for case in cases() {
        let (a, b) = (case.join("a.csv"), case.join("b.csv"));
        // Within a key, both sides keep file order, so the expected rows
        // only need a stable sort by key.
        let expected = fs::read_to_string(case.join("expected.csv")).unwrap();
        let mut rows: Vec<_> = expected.lines().collect();
        rows.sort_by_key(|r| r.split(',').next().unwrap());
        let expected: String = rows.iter().map(|r| format!("{r}\n")).collect();
        for budget in BUDGETS {
            let (result, output) = run("sort-merge", &a, &b, budget);
            let label = format!("sort-merge {} at {budget:?}", name(&case));
            assert!(
                result.status.success(),
                "{label} failed: {}",
                String::from_utf8_lossy(&result.stderr)
            );
            assert_eq!(output, expected, "{label}");
        }
    }
}

#[test]
fn every_join_type_reports_skipped_rows_by_path_and_still_joins() {
    let dir = Path::new(env!("CARGO_TARGET_TMPDIR")).join("skipped_rows");
    fs::create_dir_all(&dir).unwrap();
    let (a, b) = (dir.join("a.csv"), dir.join("b.csv"));
    fs::write(&a, b"1,a\n\xff\n3,c\n").unwrap();
    fs::write(&b, b"1,x\n3,\xff\n").unwrap();
    for join_type in JOIN_TYPES {
        let (result, output) = run(join_type, &a, &b, None);
        let stderr = String::from_utf8_lossy(&result.stderr);
        assert!(!result.status.success(), "{join_type}");
        assert_eq!(output, "1,a,x\n", "{join_type}");
        for skip in [
            format!("{}:2:1: invalid UTF-8", a.display()),
            format!("{}:2:3: invalid UTF-8", b.display()),
        ] {
            assert!(stderr.contains(&skip), "{join_type}: {stderr}");
        }
    }
}
