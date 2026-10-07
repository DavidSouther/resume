# Implementation Plan: bcdocker

*Draft 2026-10-07*

Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: none. No published agentic skill ships with `nix`, `rustix`, `libc`, `thiserror`, or std, and none was found in this harness (see `research.md`, Libraries & Skills).

**Feature test:** `pages/course/cisc_7310/bccontainer/tests/run.sh`, run with `cargo build && sudo tests/run.sh`.
**User story:** A student builds a `bookworm-slim` container root, runs commands in it as root, and sees their own PID tree, hostname, and filesystem, with the command's exit status returned to the host shell.
**Constraint:** `unsafe` appears only in the clone module. Everything else uses std or nix's safe wrappers.

**Steps:**
- [ ] Step 0: API surface area
- [ ] Step 1: Crate skeleton, command line, and environment checks
- [ ] Step 2: Rootfs builder script
- [ ] Step 3: Clone into new namespaces and supervise the application
- [ ] Step 4: Container filesystem, hostname, and `/proc`
- [ ] Step 5: Descriptor hygiene, environment, orphans, and parent death
- [ ] Step 6: Platform and manual verification

Patterns applied (`patterns:using-patterns`): **newtype** for `Hostname` and `Status`, **parse-dont-validate** for turning the command line and container argument into `Run` and `Container` once at the boundary, **errors-typed-untyped** for the `thiserror` enum, **bootstrap-and-service** for a thin `main` that wires `cli::parse` to `launch::launch`, and **arrange-act-assert** for every test below. **Type-states** was considered for the setup order in `sandbox::enter` and left out: it is five sequential calls in one function, and the feature test covers the order.

## Step 0: API surface area

Stubs only, no bodies. The Rust crate is `bcdocker`, edition 2021, with `thiserror` 2 and `nix` 0.31 (features `sched`, `mount`, `hostname`, `fs`, `process`, `user`).

```rust
// src/main.rs
#![deny(unsafe_code)]
mod cli;        // command line to Run
mod container;  // Container, Hostname
mod error;      // Error
mod launch;     // host side: clone, wait
mod sandbox;    // inside the namespaces: mounts, hostname, chroot
mod status;     // Status
mod supervise;  // PID 1: start the application, reap, exit
#[allow(unsafe_code)]
mod clone;      // the only unsafe code

// src/error.rs
#[derive(Debug, thiserror::Error)]
pub enum Error {
    Usage,
    NotLinux,
    NotRoot,
    ContainerMissing { path: PathBuf },
    BadHostname { name: String },
    Clone(#[source] Errno),
    Mount { target: &'static str, #[source] source: Errno },
    Hostname(#[source] Errno),
    Chroot(#[source] Errno),
    Mknod { device: &'static str, #[source] source: Errno },
    Exec { app: String, #[source] source: io::Error },
    Wait(#[source] Errno),
}

// src/status.rs: what the host shell sees
pub struct Status(u8);
impl Status {
    pub fn exited(code: i32) -> Status;
    pub fn signaled(signal: Signal) -> Status;       // 128 + signal
    pub fn from_wait(w: WaitStatus) -> Option<Status>;
    pub fn code(self) -> u8;
}

// src/container.rs
pub struct Hostname(String);                        // newtype; 1 to 64 bytes, no NUL or '/'
impl Hostname { pub fn parse(s: &str) -> Result<Hostname, Error>; pub fn as_str(&self) -> &str; }
pub struct Container { hostname: Hostname, rootfs: PathBuf }
impl Container {
    pub fn resolve(arg: &str, cwd: &Path) -> Result<Container, Error>;
    pub fn hostname(&self) -> &Hostname;
    pub fn rootfs(&self) -> &Path;
}

// src/cli.rs
pub struct Run { pub container: Container, pub app: String, pub args: Vec<String> }
pub fn parse(args: impl IntoIterator<Item = String>, cwd: &Path) -> Result<Run, Error>;

// src/clone.rs
pub fn spawn(child: Box<dyn FnMut() -> isize>, flags: CloneFlags) -> Result<Pid, Errno>;

// src/launch.rs (host side)
pub fn launch(run: &Run) -> Result<Status, Error>;

// src/sandbox.rs (child, in the new namespaces)
pub fn enter(container: &Container) -> Result<(), Error>;

// src/supervise.rs (PID 1)
pub fn supervise(run: &Run) -> Result<Status, Error>;
```

`main` prints `bcdocker: <error>` for any `Error` and exits 1, and exits with `Status::code()` otherwise.

## Step 1: Crate skeleton, command line, and environment checks

**Enables:** the feature test's "no binary" gate, and its missing-container assertion.

Create `Cargo.toml`, `.gitignore` (`/target`, `/containers`), `main`, the error enum, `Hostname`, `Container::resolve`, `cli::parse`, and the Linux and root checks. `main` calls `parse`, then the checks, then a `launch` that is still `todo!()`. After this step `cargo build` produces `target/debug/bcdocker`, and `bcdocker run no-such-container /bin/true` exits 1 naming `no-such-container`. The feature test still fails at the rootfs build.

Order of checks: usage, then platform (`NotLinux` on non-Linux), then root (`NotRoot` when the effective uid is not 0, with the `--privileged` hint in the message), then container resolution.

**Tests**

```rust
#[test]
fn a_bare_name_resolves_under_containers_in_the_working_directory() {
    let cwd = tempdir_with_dir("containers/tinysys");

    let c = Container::resolve("tinysys", cwd.path()).unwrap();

    assert_eq!(c.hostname().as_str(), "tinysys");
    assert_eq!(c.rootfs(), cwd.path().join("containers/tinysys"));
}
```

- An argument with a `/` is a path, and the hostname is its final component, ignoring a trailing slash.
- A missing directory gives `ContainerMissing` with the path it looked for.
- `Hostname::parse` rejects empty, over 64 bytes, and NUL; `/` is the root path and gives `BadHostname`.
- `parse` with fewer than three arguments or a first argument other than `run` gives `Usage`.
- Extra application arguments pass through unchanged, including ones that look like flags.

**Implementation Outline**

```rust
fn parse(args, cwd) -> Result<Run, Error> {
    let [_, "run", container, app, rest @ ..] = args else { return Err(Usage) };
    Run { container: Container::resolve(container, cwd)?, app, args: rest }
}
fn resolve(arg, cwd) -> Result<Container, Error> {
    let rootfs = if arg.contains('/') { arg.into() } else { cwd.join("containers").join(arg) };
    if !rootfs.is_dir() { return Err(ContainerMissing { path: rootfs }) }
    Container { hostname: Hostname::parse(last_component(&rootfs))?, rootfs }
}
```

## Step 2: Rootfs builder script

**Enables:** the feature test's "build a container root" step, so it proceeds to the probe and fails there.

`scripts/mkrootfs.sh <name>` extracts `debian:bookworm-slim` for the machine's architecture into `./containers/<name>/`. It builds in a temporary directory beside the target and renames it into place, refuses to overwrite an existing container, uses `docker create` plus `docker export` when `docker` is present and `crane export` otherwise, and leaves nothing behind on failure. Real extraction needs network; the unit test stubs the tools.

**Tests**

A bash test, `tests/mkrootfs_test.sh`, puts a stub `docker` first on `PATH`.

```bash
test_builds_the_container_directory() {
  stub_docker_exporting_tar_with "etc/os-release"      # arrange
  (cd "$work" && "$script" tinysys)                     # act
  [[ -f $work/containers/tinysys/etc/os-release ]]      # assert
}
```

- A second run for the same name exits non-zero and leaves the first build untouched.
- A stub that fails midway leaves no `containers/<name>` and no temporary directory.
- With no `docker` on `PATH` and a stub `crane`, the script uses `crane`.
- With neither, the script exits non-zero and tells the user to install one.

**Implementation Outline**

```bash
set -euo pipefail
name=$1; dest=containers/$name
[[ ! -e $dest ]] || die "$dest exists"
tmp=$(mktemp -d "containers/.$name.XXXXXX"); trap 'rm -rf "$tmp"' EXIT
if have docker; then id=$(docker create "debian:bookworm-slim"); docker export "$id" | tar -x -C "$tmp"; docker rm "$id"
elif have crane; then crane export debian:bookworm-slim - | tar -x -C "$tmp"
else die "install docker or crane"; fi
mv "$tmp" "$dest"
```

Keep the architecture implicit: Docker and crane pick the host's platform by default.

## Step 3: Clone into new namespaces and supervise the application

**Enables:** the feature test's exit-status assertions (`exit 7`, killed by SIGKILL), the missing and non-executable application messages, and `pid=2`.

Fill in `clone::spawn` (the one `unsafe` call, with its `SAFETY` comment), `launch::launch`, and `supervise::supervise`. The host side clones with `CLONE_NEWPID | CLONE_NEWNS | CLONE_NEWUTS | CLONE_NEWIPC` and `SIGCHLD`, then waits and converts the wait status to a `Status`. The cloned child is PID 1; it starts the application with `std::process::Command` (so the application is PID 2), waits for it, and exits with its status. A failed start becomes `Error::Exec` naming the application and the system's reason; the child prints it and exits 1. There is no chroot yet, so the application path is a host path at this step.

**Tests**

```rust
#[test]
fn a_signal_maps_to_128_plus_the_signal_number() {
    let status = Status::from_wait(WaitStatus::Signaled(pid(2), Signal::SIGKILL, false));

    assert_eq!(status.unwrap().code(), 137);
}
```

- `Exited(_, 7)` gives 7; `Stopped` and `Continued` give `None`.
- By hand as root, `bcdocker run /tmp /bin/sh -c 'echo $$'` prints `2`, and `... 'exit 7'` exits 7.
- A missing application gives a message naming it; a non-executable file (`/etc/passwd`) likewise.
- The host's hostname and mounts are unchanged afterward.

**Implementation Outline**

```rust
// clone.rs: allocate a 1 MiB stack, then the single unsafe call
pub fn spawn(cb, flags) -> Result<Pid, Errno> {
    let mut stack = vec![0u8; 1 << 20];
    // SAFETY: single-threaded caller; no CLONE_VM, so the child owns a copy of memory
    unsafe { nix::sched::clone(cb, &mut stack, flags, Some(SIGCHLD as i32)) }
}
// launch.rs
let pid = clone::spawn(Box::new(move || report(supervise(&run))), NS_FLAGS).map_err(Clone)?;
let wait = waitpid(pid, None).map_err(Wait)?;
Status::from_wait(wait)
// supervise.rs
let mut child = Command::new(&run.app).args(&run.args).spawn().map_err(|e| Exec { app, source: e })?;
let status = child.wait()?;   // reaping of orphans comes in step 5
```

`report` prints the typed error to stderr and returns 1, or returns the application's `Status`.

## Step 4: Container filesystem, hostname, and `/proc`

**Enables:** every remaining feature-test assertion: `host=bctest`, `hostfs=sealed`, the root listing, `seen=1,2`, `init=bcdocker`, no leftover mounts, the unchanged host hostname, and the empty rootfs `/proc`. After this step the feature test passes.

`sandbox::enter` runs in the child before it starts the application, in this order: make `/` private and recursive; set the hostname; bind-mount the rootfs onto itself; mount a fresh `proc` at `<rootfs>/proc`; mount a tmpfs at `<rootfs>/dev` and create `null`, `zero`, `full`, `random`, `urandom`, and `tty`; `chdir` to the rootfs; `chroot(".")`; `chdir("/")`. Every mount lives in the private mount namespace, so nothing remains on the host.

**Tests**

The feature test is the integration test. One unit test covers the device table:

```rust
#[test]
fn the_dev_table_lists_the_six_oci_devices_with_their_numbers() {
    let table: Vec<_> = DEV_NODES.iter().map(|d| (d.name, d.major, d.minor)).collect();

    assert_eq!(table, [("null",1,3), ("zero",1,5), ("full",1,7), ("random",1,8), ("urandom",1,9), ("tty",5,0)]);
}
```

- A rootfs missing its `proc` directory gives a `Mount` error naming `proc`.
- Under unprivileged Docker (no `CAP_SYS_ADMIN`), the first `Mount` error names `/`, and the message suggests `--privileged`.
- `/dev/null` is writable inside the container and reads empty.

**Implementation Outline**

```rust
pub fn enter(c: &Container) -> Result<(), Error> {
    mount(None, "/", None, MS_REC | MS_PRIVATE, None).map_err(|e| Mount { target: "/", source: e })?;
    sethostname(c.hostname().as_str()).map_err(Hostname)?;
    mount(Some(root), root, None, MS_BIND | MS_REC, None)?;
    mount(Some("proc"), root.join("proc"), Some("proc"), NOSUID | NOEXEC | NODEV, None)?;
    mount(Some("tmpfs"), root.join("dev"), Some("tmpfs"), NOSUID, None)?;
    for d in DEV_NODES { mknod(root.join("dev").join(d.name), CharDevice, 0o666, makedev(d.major, d.minor))?; }
    chdir(root)?; chroot(".")?; chdir("/")?;
}
```

## Step 5: Descriptor hygiene, environment, orphans, and parent death

**Enables:** design promises the feature test does not check: no inherited descriptors above 2, the `PATH` default, orphan reaping, and the container ending when the host-side process dies.

Before the application starts, PID 1 closes every descriptor above 2 (listing `/proc/self/fd` before the chroot, or after the `/proc` mount). The application inherits the launcher's environment with `PATH` set to `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`. PID 1 waits for any child, not only the application, until the application exits, so orphans are reaped. It requests `SIGKILL` when its parent dies (`prctl` parent-death signal), so killing the host-side `bcdocker` ends the container.

**Tests**

Shell tests added to `tests/run.sh` would grow the feature test; keep them in a second script, `tests/hardening.sh`, run the same way.

```bash
# descriptors: the host opens fd 9 on a host directory before running
exec 9</; out=$(run bctest /bin/sh -c 'for f in /proc/$$/fd/*; do echo ${f##*/}; done')
[[ $(paste -sd, - <<<"$out") == 0,1,2 ]]
```

- `echo $PATH` inside prints the Debian default, and a host variable `FOO=bar` is visible inside.
- An orphaned grandchild (`sh -c '(true &); sleep 0.2; grep -l "^State:.Z" /proc/[0-9]*/status'`) leaves no zombie.
- Starting `bcdocker run bctest /bin/sh -c 'sleep 30'` in the background and killing the host-side process leaves no `sleep 30` on the host within two seconds.
- A descriptor opened with close-on-exec already set is still absent.

**Implementation Outline**

```rust
fn close_extra_fds() { for fd in open_fds_above(2) { let _ = nix::unistd::close(fd); } }
let mut cmd = Command::new(app); cmd.args(args).env("PATH", DEBIAN_PATH);
// reap loop in supervise: waitpid(None, ...) until the application's pid exits
nix::sys::prctl::set_pdeathsig(Signal::SIGKILL)?;   // in the child, first thing
```

## Step 6: Platform and manual verification

**Enables:** the design's Metrics and Verification sections: macOS builds and declines, and the feature test and manual runs pass on both targets.

No new code beyond fixes found here. Verify that `cargo check` succeeds for a macOS target if one can be installed, or on the Mac itself, and that `bcdocker run` there prints the not-Linux message and exits 1; wrap Linux-only modules in `cfg(target_os = "linux")` with a stub `launch` for other platforms if the check fails. Run `cargo build && sudo tests/run.sh` on the Debian host or `bookworm-slim` VM, and again inside a privileged `rust:1-bookworm` container on Docker Desktop with the repo bind-mounted (`docker run --rm -it --privileged -v "$PWD":/src -w /src rust:1-bookworm`). Run by hand: Ctrl-C in an interactive `bcdocker run tinysys /bin/sh`, `bcdocker` without root, and under Docker without `--privileged` (expect the `--privileged` hint).

**Tests**

- `cargo clippy` and `cargo test` pass on Linux; `grep -rn unsafe src/` matches only `src/clone.rs`.
- `tests/run.sh` and `tests/hardening.sh` print `ok` on both targets.
- On Apple silicon, the rootfs built by `mkrootfs.sh` is arm64 and `tests/run.sh` passes.

**Implementation Outline**

Fix whatever the runs expose. Record the verified platforms and versions in the commit message for the step.
