//! Feature test for bcdocker: the primary user story, end to end.
//!
//! A student builds a container root from `debian:bookworm-slim`, runs commands
//! in it as root, and sees their own PID tree, hostname, and filesystem, with
//! the command's exit status coming back to the host shell.
//!
//! Run on a Linux host with root and Docker or crane:
//!
//!     sudo -E cargo test --test run

use std::{
    path::{Path, PathBuf},
    process::{Command, Output, Stdio},
};

const BCDOCKER: &str = env!("CARGO_BIN_EXE_bcdocker");

fn host_output(program: &str, args: &[&str]) -> String {
    let out = Command::new(program).args(args).output().expect(program);
    String::from_utf8(out.stdout).expect("utf8").trim().to_owned()
}

fn run_in(home: &Path, container: &str, app_and_args: &[&str]) -> Output {
    Command::new(BCDOCKER)
        .env("BCDOCKER_HOME", home)
        .arg("run")
        .arg(container)
        .args(app_and_args)
        .stdin(Stdio::null())
        .output()
        .expect("spawn bcdocker")
}

fn exit_code(out: &Output) -> i32 {
    out.status.code().expect("bcdocker exited normally")
}

#[test]
fn a_student_runs_commands_in_an_isolated_bookworm_container() {
    assert_eq!(
        host_output("id", &["-u"]),
        "0",
        "bcdocker needs root; run `sudo -E cargo test --test run`"
    );

    // 1. Build a container root from bookworm-slim into a scratch containers directory.
    let home = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("containers");
    if !home.join("bctest").exists() {
        let mkrootfs = Path::new(env!("CARGO_MANIFEST_DIR")).join("scripts/mkrootfs.sh");
        let built = Command::new(mkrootfs)
            .env("BCDOCKER_HOME", &home)
            .arg("bctest")
            .status()
            .expect("spawn scripts/mkrootfs.sh");
        assert!(built.success(), "scripts/mkrootfs.sh bctest failed");
    }
    let host_hostname = host_output("hostname", &[]);

    // 2. Run a shell in it and look around.
    let probe = format!(
        r#"echo pid=$$
echo host=$(hostname)
echo init=$(cat /proc/1/comm)
for p in /proc/[0-9]*; do echo seen=${{p#/proc/}}; done
echo root=$(ls /)
if [ -e {home} ]; then echo hostfs=leaked; else echo hostfs=sealed; fi"#,
        home = home.display()
    );
    let out = run_in(&home, "bctest", &["/bin/sh", "-c", &probe]);
    assert_eq!(exit_code(&out), 0, "stderr: {}", String::from_utf8_lossy(&out.stderr));
    let stdout = String::from_utf8(out.stdout).expect("utf8");
    let lines: Vec<&str> = stdout.lines().collect();

    // The launcher is PID 1 and the application is its child.
    assert!(lines.contains(&"pid=2"), "application is PID 2: {stdout}");
    assert!(lines.contains(&"init=bcdocker"), "PID 1 is bcdocker: {stdout}");
    // Only the container's own processes are visible.
    let seen: Vec<&str> = lines.iter().filter_map(|l| l.strip_prefix("seen=")).collect();
    assert_eq!(seen, ["1", "2"], "only container PIDs are visible: {stdout}");
    // The container has its own hostname, and the host's is untouched.
    assert!(lines.contains(&"host=bctest"), "container hostname: {stdout}");
    assert_eq!(host_output("hostname", &[]), host_hostname, "host hostname unchanged");
    // The filesystem is the bookworm-slim root, sealed from the host.
    let root = lines.iter().find_map(|l| l.strip_prefix("root=")).expect("root listing");
    for dir in ["bin", "etc", "usr", "proc"] {
        assert!(root.split(' ').any(|d| d == dir), "{dir} in container root: {root}");
    }
    assert!(lines.contains(&"hostfs=sealed"), "host paths are not visible: {stdout}");

    // 3. Exit status and failure codes reach the host shell.
    assert_eq!(exit_code(&run_in(&home, "bctest", &["/bin/sh", "-c", "exit 7"])), 7);
    assert_eq!(exit_code(&run_in(&home, "bctest", &["/bin/sh", "-c", "kill -9 $$"])), 128 + 9);
    assert_eq!(exit_code(&run_in(&home, "bctest", &["/nonexistent"])), 127, "app not found");
    assert_eq!(exit_code(&run_in(&home, "bctest", &["/etc/passwd"])), 126, "app not executable");
    let missing = run_in(&home, "no-such-container", &["/bin/true"]);
    assert_eq!(exit_code(&missing), 125, "setup failure");
    assert!(
        String::from_utf8_lossy(&missing.stderr).contains("no-such-container"),
        "error names the container: {}",
        String::from_utf8_lossy(&missing.stderr)
    );
}
