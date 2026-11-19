use std::process::Command;

#[test]
fn benchmark_emits_matched_controls_and_per_sample_counters() {
    let output = Command::new(env!("CARGO_BIN_EXE_switchbench"))
        .args(["--switches", "1000", "--reps", "2", "--working-sets", "0,4096",
               "--stride", "128", "--access", "read"])
        .output().unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    let text = String::from_utf8(output.stdout).unwrap();
    let mut lines = text.lines();
    let header: Vec<_> = lines.next().unwrap().split(',').collect();
    let rows: Vec<Vec<_>> = lines.map(|l| l.split(',').collect()).collect();
    let col = |name| header.iter().position(|h| *h == name).unwrap();
    for size in ["0", "4096"] {
        for name in ["thread", "process", "ucontext", "regswitch", "green", "baseline-socket", "baseline-work"] {
            let row = rows.iter().find(|r| r[col("mechanism")] == name && r[col("working_set_bytes")] == size).unwrap();
            assert_eq!(row[col("stride_bytes")], "128");
            assert_eq!(row[col("access")], "read");
            assert_eq!(row[col("measured_reps")], "2");
            if name == "thread" || name == "process" {
                let voluntary: u64 = row[col("nvcsw")].parse().unwrap();
                assert!(voluntary > 300 && voluntary < 2000, "unexpected median sample count: {voluntary}");
            }
        }
    }
}

#[test]
fn zero_stride_is_rejected() {
    let output = Command::new(env!("CARGO_BIN_EXE_switchbench"))
        .args(["--mechanisms", "thread", "--stride", "0"])
        .output().unwrap();
    assert!(!output.status.success());
}
