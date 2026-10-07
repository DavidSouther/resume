//! Feature test for bcdocker: the primary user story, end to end.
//!
//! A student builds a container root from `debian:bookworm-slim`, runs commands
//! in it as root, and sees their own PID tree, hostname, and filesystem, with
//! the command's exit status coming back to the host shell.
//!
//! Run on a Linux host with root and Docker or crane. Root needs to find cargo:
//!
//!     sudo env "PATH=$PATH" cargo test --test run

use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Output, Stdio},
};

const BCDOCKER: &str = env!("CARGO_BIN_EXE_bcdocker");

fn host_hostname() -> String {
    fs::read_to_string("/proc/sys/kernel/hostname").expect("hostname").trim().to_owned()
}

fn run_in(work: &Path, container: &str, app_and_args: &[&str]) -> Output {
    Command::new(BCDOCKER)
        .current_dir(work)
        .arg("run")
        .arg(container)
        .args(app_and_args)
        .stdin(Stdio::null())
        .output()
        .expect("spawn bcdocker")
}

fn stderr(out: &Output) -> String {
    String::from_utf8_lossy(&out.stderr).into_owned()
}

fn exit_code(out: &Output) -> i32 {
    out.status.code().unwrap_or_else(|| panic!("bcdocker exited normally; stderr: {}", stderr(out)))
}

#[test]
fn a_student_runs_commands_in_an_isolated_bookworm_container() {
    let uid = Command::new("id").arg("-u").output().expect("id");
    assert_eq!(
        String::from_utf8_lossy(&uid.stdout).trim(),
        "0",
        "bcdocker needs root; run `sudo env \"PATH=$PATH\" cargo test --test run`"
    );

    // 1. Build a container root from bookworm-slim, in a scratch working directory.
    let work = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("work");
    fs::create_dir_all(&work).expect("work dir");
    if !work.join("containers/bctest").exists() {
        let mkrootfs = Path::new(env!("CARGO_MANIFEST_DIR")).join("scripts/mkrootfs.sh");
        let built = Command::new(mkrootfs)
            .current_dir(&work)
            .arg("bctest")
            .status()
            .expect("spawn scripts/mkrootfs.sh");
        assert!(built.success(), "scripts/mkrootfs.sh bctest failed");
    }
    let rootfs = work.join("containers/bctest");
    let host_name = host_hostname();

    // 2. Run a shell in it and look around.
    let probe = format!(
        r#"echo pid=$$
echo host=$(cat /proc/sys/kernel/hostname)
echo init=$(cat /proc/1/comm)
for p in /proc/[0-9]*; do echo seen=${{p#/proc/}}; done
echo root=$(ls /)
if [ -e '{work}' ]; then echo hostfs=leaked; else echo hostfs=sealed; fi"#,
        work = work.display()
    );
    let out = run_in(&work, "bctest", &["/bin/sh", "-c", &probe]);
    assert_eq!(exit_code(&out), 0, "stderr: {}", stderr(&out));
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
    assert_eq!(host_hostname(), host_name, "host hostname unchanged");
    // The filesystem is the bookworm-slim root, sealed from the host.
    let root = lines.iter().find_map(|l| l.strip_prefix("root=")).expect("root listing");
    for dir in ["bin", "etc", "usr", "proc"] {
        assert!(root.split(' ').any(|d| d == dir), "{dir} in container root: {root}");
    }
    assert!(lines.contains(&"hostfs=sealed"), "host paths are not visible: {stdout}");
    // Nothing the container mounted is left on the host, and the rootfs is untouched.
    let mounts = fs::read_to_string("/proc/mounts").expect("mounts");
    assert!(!mounts.contains(rootfs.to_str().expect("utf8 path")), "no leftover mounts");
    assert_eq!(
        fs::read_dir(rootfs.join("proc")).expect("rootfs proc").count(),
        0,
        "rootfs /proc is still an empty directory"
    );

    // 3. Exit status and failures reach the host shell, each with a named reason.
    assert_eq!(exit_code(&run_in(&work, "bctest", &["/bin/sh", "-c", "exit 7"])), 7);
    assert_eq!(exit_code(&run_in(&work, "bctest", &["/bin/sh", "-c", "kill -9 $$"])), 128 + 9);

    let missing_app = run_in(&work, "bctest", &["/nonexistent"]);
    assert_ne!(exit_code(&missing_app), 0);
    assert!(stderr(&missing_app).contains("/nonexistent"), "names the app: {}", stderr(&missing_app));

    let not_executable = run_in(&work, "bctest", &["/etc/passwd"]);
    assert_ne!(exit_code(&not_executable), 0);
    assert!(stderr(&not_executable).contains("/etc/passwd"), "names the app: {}", stderr(&not_executable));

    let missing_container = run_in(&work, "no-such-container", &["/bin/true"]);
    assert_ne!(exit_code(&missing_container), 0);
    assert!(
        stderr(&missing_container).contains("no-such-container"),
        "names the container: {}",
        stderr(&missing_container)
    );
}
