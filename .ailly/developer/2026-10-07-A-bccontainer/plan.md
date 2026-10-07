# Implementation Plan: bcdocker

*Draft 2026-10-07*

Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: none. No published agentic skill ships with `nix`, `rustix`, `libc`, `thiserror`, or std, and none was found in this harness (see `research.md`, Libraries & Skills).

**Feature test:** `pages/course/cisc_7310/bccontainer/tests/run.sh`, run with `cargo build && sudo tests/run.sh`.
**User story:** A student builds a `bookworm-slim` container root, runs commands in it as root, and sees their own PID tree, hostname, and filesystem, with the command's exit status returned to the host shell.
**Constraint:** `unsafe` appears only in the clone module. Everything else uses std or nix's safe wrappers.

**Steps:**
- [ ] Step 0: API surface area
- [ ] Step 1: Crate skeleton, command line, environment checks, and platform gating
- [ ] Step 2: Rootfs builder script
- [ ] Step 3: Clone into new namespaces and supervise the application
- [ ] Step 4: Container filesystem, hostname, and `/proc`
- [ ] Step 5: Descriptor hygiene, environment, orphans, and parent death
- [ ] Step 6: Platform and manual verification

Patterns applied (`patterns:using-patterns`): **newtype** for `Hostname` and `Status`, **parse-dont-validate** for turning the command line into `Args` and then `Run` once at the boundary, **errors-typed-untyped** for one `thiserror` enum per module under a top-level enum, **bootstrap-and-service** for a thin `main` that wires `cli::parse` to `launch::launch`, and **arrange-act-assert** for every test below. **Type-states** was considered for the setup order in `sandbox::enter` and left out: it is five sequential calls in one function, and the feature test covers the order.

## Step 0: API surface area

Stubs only, no bodies. The Rust crate is `bcdocker`, edition 2021, with `thiserror` 2 and `nix` 0.31 (features `sched`, `mount`, `hostname`, `fs`, `process`, `user`). nix is a normal dependency: its `Errno` is portable, and only the code that calls Linux-only functions is gated with `cfg(target_os = "linux")`.

```rust
// src/main.rs
#![deny(unsafe_code)]
mod cli;        // command line: Args, Run
mod container;  // Container, Hostname
mod error;      // top-level Error
mod status;     // Status
#[cfg(target_os = "linux")] mod launch;     // host side: clone, wait
#[cfg(target_os = "linux")] mod sandbox;    // inside the namespaces: mounts, hostname, chroot
#[cfg(target_os = "linux")] mod supervise;  // PID 1: start the application, reap, exit
#[cfg(target_os = "linux")] #[allow(unsafe_code)] mod clone;  // the only unsafe code

// src/error.rs: what main prints as `bcdocker: <error>`
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("bcdocker needs Linux namespaces")] NotLinux,
    #[error("bcdocker needs root; under Docker, run with --privileged")] NotRoot,
    #[error(transparent)] Cli(#[from] cli::Error),
    #[error(transparent)] Container(#[from] container::Error),
    #[error(transparent)] Launch(#[from] launch::Error),
    #[error(transparent)] Sandbox(#[from] sandbox::Error),
    #[error(transparent)] Supervise(#[from] supervise::Error),
}
// per module
cli::Error        { Usage }
container::Error  { Missing { path: PathBuf }, BadHostname { name: String } }
launch::Error     { Clone(#[source] Errno) /* message adds the --privileged hint on EPERM */, Wait(#[source] io::Error) }
sandbox::Error    { Mount { target: &'static str, source: Errno }, Hostname(Errno), Chroot(Errno), Mknod { device: &'static str, source: Errno } }
supervise::Error  { Exec { app: String, source: io::Error }, Wait(io::Error) }

// src/status.rs: what the host shell sees
pub struct Status(u8);
impl Status {
    pub fn from_wait(w: WaitStatus) -> Option<Status>;            // Exited or Signaled; others None
    pub fn from_process(s: std::process::ExitStatus) -> Status;   // code, or 128 + signal
    pub fn code(self) -> u8;
}

// src/container.rs
pub struct Hostname(String);                        // newtype; 1 to 64 bytes, no NUL or '/'
impl Hostname { pub fn parse(s: &str) -> Result<Hostname, container::Error>; pub fn as_str(&self) -> &str; }
pub struct Container { hostname: Hostname, rootfs: PathBuf }
impl Container {
    pub fn resolve(arg: &str, cwd: &Path) -> Result<Container, container::Error>;
    pub fn hostname(&self) -> &Hostname;
    pub fn rootfs(&self) -> &Path;
}

// src/cli.rs
pub struct Args { pub container: String, pub app: String, pub args: Vec<String> }
pub fn parse(args: impl IntoIterator<Item = String>) -> Result<Args, cli::Error>;
pub struct Run { pub container: Container, pub app: String, pub args: Vec<String> }
impl Run { pub fn resolve(args: Args, cwd: &Path) -> Result<Run, container::Error>; }

// src/clone.rs
pub fn spawn(child: nix::sched::CloneCb<'_>, flags: CloneFlags) -> Result<Pid, Errno>;

// src/launch.rs (host side)
pub fn launch(run: &Run) -> Result<Status, launch::Error>;

// src/sandbox.rs (child, in the new namespaces)
pub fn enter(container: &Container) -> Result<(), sandbox::Error>;

// src/supervise.rs (PID 1)
pub fn supervise(run: &Run) -> Result<Status, supervise::Error>;
```

`main` prints `bcdocker: <error>` for any `Error` and exits 1, and exits with `Status::code()` otherwise.

## Step 1: Crate skeleton, command line, environment checks, and platform gating

**Enables:** the feature test's "no binary" gate, its missing-container assertion, and the design's macOS promise (the build succeeds, running declines).

Create `Cargo.toml`, `.gitignore` (`/target`, `/containers`), `main`, the error enums, `Hostname`, `Container::resolve`, `cli::parse`, `Run::resolve`, and the checks. The Linux-only modules are gated now, so every later step keeps the macOS build working. On non-Linux targets `main` returns `NotLinux` right after parsing. On Linux it checks root, resolves the container, then calls `launch`, which is `todo!()` until step 3. After this step `cargo build` produces `target/debug/bcdocker`, and `bcdocker run no-such-container /bin/true` exits 1 naming `no-such-container`. The feature test still fails at the rootfs build.

Order of checks: usage (`cli::parse`), then platform, then root (effective uid not 0 gives `NotRoot`), then container resolution. Resolution is a separate call so the first three can fail on any container name.

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
- A missing directory gives `Missing` with the path it looked for.
- `Hostname::parse` rejects empty, over 64 bytes, and NUL; `/` as a path gives `BadHostname`.
- `parse` with fewer than three arguments or a first argument other than `run` gives `Usage`.
- Extra application arguments pass through unchanged, including ones that look like flags.
- Where a macOS target can be installed, `cargo check --target aarch64-apple-darwin` passes.

**Implementation Outline**

```rust
fn parse(args) -> Result<Args, cli::Error> {
    let [_, "run", container, app, rest @ ..] = args else { return Err(Usage) };
    Args { container, app, args: rest }
}
fn resolve(arg, cwd) -> Result<Container, container::Error> {
    let rootfs = if arg.contains('/') { arg.into() } else { cwd.join("containers").join(arg) };
    if !rootfs.is_dir() { return Err(Missing { path: rootfs }) }
    Container { hostname: Hostname::parse(last_component(&rootfs))?, rootfs }
}
```

## Step 2: Rootfs builder script

**Enables:** the feature test's "build a container root" step, so it proceeds to the probe and fails there.

`scripts/mkrootfs.sh <name>` extracts `debian:bookworm-slim` for the machine's architecture into `./containers/<name>/`. It creates `containers/` if needed, builds in a temporary directory beside the target and renames it into place, refuses to overwrite an existing container, uses `docker create` plus `docker export` when `docker` is present and `crane export` otherwise, and leaves nothing behind on failure. The container's root directory is made mode 755 (a temporary directory is created 0700). Real extraction needs network, so the test stubs the tools.

**Tests**

A bash test, `tests/mkrootfs_test.sh`, kept in the repository, puts a stub `docker` first on `PATH`.

```bash
test_builds_the_container_directory() {
  stub_docker_exporting_tar_with "etc/os-release"      # arrange
  (cd "$work" && "$script" tinysys)                     # act
  [[ -f $work/containers/tinysys/etc/os-release ]]      # assert
}
```

- A first run on an empty working directory succeeds, and the container directory is mode 755.
- A second run for the same name exits non-zero and leaves the first build untouched.
- A stub that fails midway leaves no `containers/<name>` and no temporary directory.
- With no `docker` on `PATH` and a stub `crane`, the script uses `crane`.
- With neither, the script exits non-zero and tells the user to install one.

**Implementation Outline**

```bash
set -euo pipefail
name=$1; dest=containers/$name
[[ ! -e $dest ]] || die "$dest exists"
mkdir -p containers
tmp=$(mktemp -d "containers/.$name.XXXXXX"); trap 'rm -rf "$tmp"' EXIT
if have docker; then id=$(docker create "debian:bookworm-slim"); docker export "$id" | tar -x -C "$tmp"; docker rm "$id"
elif have crane; then crane export debian:bookworm-slim - | tar -x -C "$tmp"
else die "install docker or crane"; fi
chmod 755 "$tmp"; mv "$tmp" "$dest"
```

Keep the architecture implicit: Docker and crane pick the host's platform by default.

## Step 3: Clone into new namespaces and supervise the application

**Enables:** the feature test's exit-status assertions (`exit 7`, killed by SIGKILL), the missing and non-executable application messages, and `pid=2`.

Fill in `clone::spawn` (the one `unsafe` call, with its `SAFETY` comment), `launch::launch`, and `supervise::supervise`. The host side clones with `CLONE_NEWPID | CLONE_NEWNS | CLONE_NEWUTS | CLONE_NEWIPC` and `SIGCHLD`, then waits and converts the wait status to a `Status`. The cloned child is PID 1; it starts the application with `std::process::Command` (so the application is PID 2), waits for it, and exits with its status. A failed start becomes `supervise::Error::Exec` naming the application and the system's reason; the child prints it and exits 1. There is no chroot yet, so the application path is a host path at this step. A `clone` that fails with `EPERM` (no `CAP_SYS_ADMIN`, as in unprivileged Docker) says so and suggests `--privileged`.

**Tests**

```rust
#[test]
fn a_signal_maps_to_128_plus_the_signal_number() {
    let status = Status::from_wait(WaitStatus::Signaled(pid(2), Signal::SIGKILL, false));

    assert_eq!(status.unwrap().code(), 137);
}
```

- `Exited(_, 7)` gives 7; `Stopped` and `Continued` give `None`; `from_process` agrees for a normal exit and a signal.
- By hand as root, `bcdocker run /tmp /bin/sh -c 'echo $$'` prints `2`, and `... 'exit 7'` exits 7.
- A missing application gives a message naming it; a non-executable file (`/etc/passwd`) likewise.
- The host's hostname and mounts are unchanged afterward.
- Under unprivileged Docker the `clone` error carries the `--privileged` hint.

**Implementation Outline**

```rust
// clone.rs: allocate a 1 MiB stack, then the single unsafe call
pub fn spawn(cb, flags) -> Result<Pid, Errno> {
    let mut stack = vec![0u8; 1 << 20];
    // SAFETY: single-threaded caller; no CLONE_VM, so the child owns a copy of memory.
    // The child only runs supervise and sandbox code, which uses far less than 1 MiB.
    unsafe { nix::sched::clone(cb, &mut stack, flags, Some(SIGCHLD as i32)) }
}
// launch.rs: the closure borrows `run`; CloneCb<'_> allows that
let pid = clone::spawn(Box::new(|| report(supervise(run))), NS_FLAGS).map_err(Clone)?;
let wait = waitpid(pid, None).map_err(|e| Wait(e.into()))?;
Status::from_wait(wait).ok_or_else(|| Wait(io::Error::other("unexpected wait status")))
// supervise.rs
let mut child = Command::new(&run.app).args(&run.args).spawn().map_err(|e| Exec { app, source: e })?;
Ok(Status::from_process(child.wait().map_err(Wait)?))   // replaced by a reap loop in step 5
```

`report` prints the typed error to stderr and returns 1, or returns the application's `Status` code as the child's exit value.

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
- `/dev/null` is writable inside the container and reads empty.

**Implementation Outline**

```rust
pub fn enter(c: &Container) -> Result<(), sandbox::Error> {
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

After `sandbox::enter` (so `/proc` is mounted), PID 1 lists `/proc/self/fd`, collects the numbers, then closes every descriptor above 2. The application inherits the launcher's environment with `PATH` set to `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`. The reap loop replaces `Child::wait`: PID 1 waits for any child with `waitpid(None)` and returns when the pid matches the application's, so orphans are reaped and the application's status is not lost. As its first act, PID 1 requests `SIGKILL` when its parent dies (`prctl` parent-death signal), so killing the host-side `bcdocker` ends the container. A small window remains if the parent dies before the call; the usual check of the parent pid cannot close it, because the parent pid reads 0 inside a new PID namespace.

**Tests**

The checks live in a second script, `tests/hardening.sh`, run like `run.sh`. It uses the same `target/test-work` and builds the container with `mkrootfs.sh` if it is absent.

```bash
# descriptors: the host opens fd 9 on a host directory before running
exec 9</; out=$(run bctest /bin/sh -c 'for f in /proc/$$/fd/*; do echo ${f##*/}; done')
[[ $(paste -sd, - <<<"$out") == 0,1,2 ]]
```

- `echo $PATH` inside prints the Debian default, and a host variable `FOO=bar` is visible inside.
- An orphaned grandchild (`sh -c '(true &); sleep 0.2; grep -l "^State:.Z" /proc/[0-9]*/status'`) leaves no zombie.
- Starting `bcdocker run bctest /bin/sh -c 'sleep 30'` in the background and killing the host-side process leaves no `sleep 30` on the host within two seconds.
- A descriptor opened with close-on-exec already set is still absent.
- The application's exit status is still correct when an orphan exits first.

**Implementation Outline**

```rust
fn close_extra_fds() { for fd in open_fds_above(2) { let _ = nix::unistd::close(fd); } }
let child = Command::new(app).args(args).env("PATH", DEBIAN_PATH).spawn()?;
let app_pid = Pid::from_raw(child.id() as i32);
loop { let w = waitpid(None, None)?; if w.pid() == Some(app_pid) { return Status::from_wait(w) } }
nix::sys::prctl::set_pdeathsig(Signal::SIGKILL)?;   // first thing in the child
```

## Step 6: Platform and manual verification

**Enables:** the design's Metrics and Verification sections: macOS builds and declines, and the feature test and manual runs pass on both targets.

No new code beyond fixes found here. On the Mac, `cargo build` succeeds and `bcdocker run` prints the not-Linux message and exits 1. Run `cargo build && sudo tests/run.sh` and `sudo tests/hardening.sh` on the Debian host or `bookworm-slim` VM, and again inside a privileged `rust:1-bookworm` container on Docker Desktop with the repo bind-mounted (`docker run --rm -it --privileged -v "$PWD":/src -w /src rust:1-bookworm`). Run by hand: Ctrl-C in an interactive `bcdocker run tinysys /bin/sh`, `bcdocker` without root, a rootfs built for the other architecture, and under Docker without `--privileged` (expect the `--privileged` hint).

**Tests**

- `cargo clippy` and `cargo test` pass on Linux; `grep -rn unsafe src/ | grep -v unsafe_code` matches only `src/clone.rs`.
- `tests/run.sh` and `tests/hardening.sh` print `ok` on both targets.
- On Apple silicon, the rootfs built by `mkrootfs.sh` is arm64 and `tests/run.sh` passes.

**Implementation Outline**

Fix whatever the runs expose.
