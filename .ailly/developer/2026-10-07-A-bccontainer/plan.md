# Implementation Plan: bcdocker

Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: none. No published agentic skill ships with `nix`, `rustix`, `libc`, `thiserror`, or std, and none was found in this harness (see `research.md`, Libraries & Skills).

**Feature test:** `pages/course/cisc_7310/bccontainer/tests/run.sh`, run with `cargo build && sudo tests/run.sh`.
**User story:** A student builds a `bookworm-slim` container root, runs commands in it as root, and sees their own PID tree, hostname, and filesystem, with the command's exit status returned to the host shell.
**Constraint:** `unsafe` appears only in the clone module, as one call. Everything else uses std or nix's safe wrappers.

**Steps:**
- [x] Step 0: API surface area
- [x] Step 1: Crate skeleton, command line, environment checks, and platform gating
- [x] Step 2: Rootfs builder script
- [x] Step 3: Clone into new namespaces and supervise the application
- [x] Step 4: Container filesystem, hostname, and `/proc`
- [x] Step 5: Descriptor hygiene, environment, orphans, and parent death
- [ ] Step 6: Platform and manual verification

Patterns applied (`patterns:using-patterns`): **newtype** for `Hostname` and `Status`, **parse-dont-validate** for turning the command line into `Args` and then `Run` once at the boundary, **errors-typed-untyped** for one `thiserror` enum per module under a top-level enum, **bootstrap-and-service** for a thin `main` that wires `cli::parse` to `launch::launch`, and **arrange-act-assert** for every test below. **Type-states** was considered for the setup order in `sandbox::enter` and left out: it is a fixed sequence of calls in one function, and the feature test covers the order.

## Step 0: API surface area

Stubs only, no bodies. The Rust crate is `bcdocker`, edition 2021, with `rust-version = "1.96"` under `[package]` (E6 in `clone.rs` needs at least 1.81, where a panic unwinding out of an `extern "C"` function starts to abort; 1.96 also provides `std::assert_matches!` for the tests), `thiserror = "2"` and `nix = { version = "=0.31.3", features = ["sched", "mount", "hostname", "fs", "process", "signal", "user"] }`. nix is pinned exactly because the `SAFETY` comment in `clone.rs` relies on its audited source. nix is a normal dependency: its `Errno` is portable, and only the code that calls Linux-only functions is gated with `cfg(target_os = "linux")`.

```rust
// src/main.rs
#![deny(unsafe_code)]
mod cli;        // command line: Args, Run
mod container;  // Container, Hostname
mod error;      // top-level Error
mod status;     // Status
#[cfg(target_os = "linux")] mod launch;     // host side: clone, wait
#[cfg(target_os = "linux")] mod sandbox;    // inside the namespaces: mounts, hostname, chroot
#[cfg(target_os = "linux")] mod supervise;  // PID 1: its whole life, from pdeathsig to exit
#[cfg(target_os = "linux")] #[allow(unsafe_code)] mod clone;  // the only unsafe code

// src/error.rs: main prints `bcdocker: {e}`. Every leaf message starts with its step,
// so the line reads `bcdocker: <step>: <reason>`.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[cfg(not(target_os = "linux"))] #[error("platform: bcdocker needs Linux namespaces")] NotLinux,
    #[cfg(target_os = "linux")] #[error("privilege: bcdocker needs root; under Docker, run with --privileged")] NotRoot,
    #[error(transparent)] Cli(#[from] cli::Error),
    #[error(transparent)] Container(#[from] container::Error),
    #[cfg(target_os = "linux")] #[error(transparent)] Launch(#[from] launch::Error),
}
// per module, with each variant's #[error] text
cli::Error        { Usage }                                    // "usage: bcdocker run <container> <app> [args...]"
container::Error  { Missing { path: PathBuf },                 // "container: no directory at {path}"
                    BadHostname { name: String } }             // "container: {name:?} is not a valid hostname"
clone::Error      { Threads,                                   // "clone: the process has more than one thread"
                    Clone(#[source] Errno) }                   // "clone: {0}", plus "; under Docker, run with --privileged" on EPERM
launch::Error     { Clone(#[from] clone::Error),               // transparent
                    Wait(#[source] Errno) }                    // "wait: {0}"
sandbox::Error    { Mount { target: &'static str, source: Errno },     // "mount {target}: {source}"
                    Hostname(#[source] Errno),                         // "sethostname: {0}"
                    Chroot(#[source] Errno),                           // "chroot: {0}"
                    Mknod { device: &'static str, source: Errno } }    // "mknod /dev/{device}: {source}"
supervise::Error  { Pdeathsig(#[source] Errno),                // "prctl: {0}"
                    Sandbox(#[from] sandbox::Error),           // transparent
                    Fds(#[source] io::Error),                  // "close fds: {0}"
                    Exec { app: String, source: io::Error },   // "exec {app}: {source}"
                    Wait(#[source] Errno) }                    // "wait: {0}"

// src/status.rs: what the host shell sees
pub struct Status(u8);
impl Status {
    pub fn from_wait(w: WaitStatus) -> Option<Status>;   // Exited gives the code, Signaled gives 128 + signal; others None
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

// src/clone.rs: flags, stack, and closure are fixed inside the module
pub fn spawn(run: &Run) -> Result<Pid, clone::Error>;

// src/launch.rs (host side)
pub fn launch(run: &Run) -> Result<Status, launch::Error>;

// src/sandbox.rs (child, in the new namespaces)
pub fn enter(container: &Container) -> Result<(), sandbox::Error>;

// src/supervise.rs (PID 1): pdeathsig, enter, close fds, spawn, reap, report
pub fn container_main(run: &Run) -> i32;
```

`main` prints `bcdocker: {e}` for any `Error` and exits 1, and exits with `Status::code()` otherwise. The host never sees a `sandbox::Error` or a `supervise::Error`: `container_main` prints those inside the container and returns 1.

## Step 1: Crate skeleton, command line, environment checks, and platform gating

**Enables:** the feature test's "no binary" gate and the design's macOS promise. The missing-container behavior is checked by hand here (`sudo target/debug/bcdocker run no-such-container /bin/true` exits 1 naming it); `run.sh` first reaches that assertion after Step 2.

Create `Cargo.toml`, `.gitignore` (`/target`, `/containers`), `main`, the error enums, `Hostname`, `Container::resolve`, `cli::parse`, `Run::resolve`, and the checks. The Linux-only modules are gated now, so every later step keeps the macOS build working. The `Error` variants that wrap Linux-only modules, and `main`'s call to `launch`, carry the same `cfg`. On non-Linux targets `main` returns `NotLinux` right after parsing. On Linux it checks root, resolves the container, then calls `launch`, which is `todo!()` until Step 3. After this step `cargo build` produces `target/debug/bcdocker`. The feature test still fails at the rootfs build.

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

- An argument with a `/` is a path joined to `cwd` (`cwd.join(arg)`), so a relative path resolves against the `cwd` parameter and an absolute one replaces it. The hostname is its final component, ignoring a trailing slash.
- A missing directory gives `Missing` with the path it looked for.
- `Hostname::parse` rejects an empty name, a name over 64 bytes, and one containing NUL or `/`.
- The container argument `/` has no final component, so `Container::resolve` gives `BadHostname`.
- `parse` with fewer than three arguments after the program name or a first argument other than `run` gives `Usage`.
- Extra application arguments pass through unchanged, including ones that look like flags.
- `Error::NotRoot` displays as `privilege: bcdocker needs root; under Docker, run with --privileged`, so `main`'s line carries a single `bcdocker:` prefix.
- Where a macOS target can be installed, `cargo check --target aarch64-apple-darwin` passes.

**Implementation Outline**

```rust
fn parse(args: impl IntoIterator<Item = String>) -> Result<Args, cli::Error> {
    let args: Vec<String> = args.into_iter().collect();
    match args.as_slice() {
        [_, cmd, container, app, rest @ ..] if cmd == "run" =>
            Ok(Args { container: container.clone(), app: app.clone(), args: rest.to_vec() }),
        _ => Err(cli::Error::Usage),
    }
}
fn resolve(arg: &str, cwd: &Path) -> Result<Container, container::Error> {
    let rootfs = if arg.contains('/') { cwd.join(arg) } else { cwd.join("containers").join(arg) };
    if !rootfs.is_dir() { return Err(Missing { path: rootfs }) }
    let name = rootfs.file_name().and_then(OsStr::to_str).ok_or_else(|| BadHostname { name: arg.into() })?;
    Ok(Container { hostname: Hostname::parse(name)?, rootfs })
}
```

## Step 2: Rootfs builder script

**Enables:** the feature test's "build a container root" step, so it proceeds to the probe and fails there. `run.sh` now also reaches its missing-container assertion, which Step 1 already satisfies.

`scripts/mkrootfs.sh <name> [image]` extracts the image, `debian:bookworm-slim` by default, for the machine's architecture into `./containers/<name>/`. It creates `containers/` if needed, builds in a temporary directory beside the target and renames it into place, refuses to overwrite an existing container, uses `docker create` plus `docker export` when `docker info >/dev/null 2>&1` succeeds (the daemon is reachable, not just the CLI installed) and `crane export` otherwise, and leaves nothing behind on failure, including a created Docker container. The container's root directory is made mode 755 (a temporary directory is created 0700). Real extraction needs network, so the test stubs the tools.

Pass the platform explicitly. crane defaults to `linux/amd64` on every host (go-containerregistry `remote.defaultPlatform`), so the script maps `uname -m` to `linux/amd64` or `linux/arm64` and passes `--platform` to both tools.

**Tests**

A bash test, `tests/mkrootfs_test.sh`, kept in the repository, puts a stub `docker` first on `PATH`; the stub answers `docker info` with status 0. Tests that need `docker` absent run the script with `PATH` set only to a temporary directory holding the stub tools and symlinks to the binaries the script needs (`bash`, `tar`, `mktemp`, `uname`, `chmod`, `mv`, `rm`, `mkdir`, and any other utilities it calls), so the host's real `docker` in `/usr/bin` is not found.

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
- A stub `docker export` that fails is followed by `docker rm` of the created id (the stub records it).
- With no `docker` on `PATH` (the restricted `PATH` above) and a stub `crane`, the script uses `crane`.
- With a stub `docker` whose `info` fails and a stub `crane`, the script uses `crane`.
- The stub `crane` records its arguments, which include `--platform linux/<arch>` for the host's `uname -m`.
- With neither on the restricted `PATH`, the script exits non-zero and tells the user to install one.
- A second argument replaces the default image for both tools; more than two arguments is a usage error.

**Implementation Outline**

```bash
set -euo pipefail
name=$1; image=${2:-debian:bookworm-slim}; dest=containers/$name
[[ ! -e $dest ]] || die "$dest exists"
case $(uname -m) in
  x86_64|amd64) arch=amd64 ;;
  aarch64|arm64) arch=arm64 ;;
  *) die "unsupported architecture $(uname -m)" ;;
esac
mkdir -p containers
tmp=$(mktemp -d "containers/.$name.XXXXXX")
trap 'rm -rf "$tmp"; [[ -z ${id:-} ]] || docker rm -f "$id" >/dev/null 2>&1 || true' EXIT
if docker info >/dev/null 2>&1; then id=$(docker create --platform "linux/$arch" "$image"); docker export "$id" | tar -x -C "$tmp"
elif have crane; then crane export --platform "linux/$arch" "$image" - | tar -x -C "$tmp"
else die "install docker or crane"; fi
chmod 755 "$tmp"; mv "$tmp" "$dest"
```

## Step 3: Clone into new namespaces and supervise the application

**Enables:** the feature test's exit-status assertions (`exit 7`, killed by SIGKILL), the missing and non-executable application messages, and `pid=2`.

Fill in `clone::spawn` (the one `unsafe` call, with its `SAFETY` comment), `launch::launch`, and `supervise::container_main`. `clone.rs` clones with a fixed `CLONE_FLAGS` constant (`CLONE_NEWPID | CLONE_NEWNS | CLONE_NEWUTS | CLONE_NEWIPC`) plus `SIGCHLD`; callers cannot choose flags. It builds the only closure it clones, which calls `supervise::container_main(run)`, and it refuses with `clone::Error::Threads` unless `/proc/self/task` is on procfs and lists exactly one thread. The host side waits for the child and converts its wait status to a `Status`.

The cloned child is PID 1. `container_main` runs PID 1's steps in order, prints any `supervise::Error` as `bcdocker: <error>` to stderr and returns 1, or returns the application's `Status` code. At this step `supervise`, which `container_main` calls, only starts the application with `std::process::Command` (so the application is PID 2) and waits for it with `waitpid`. A failed start becomes `supervise::Error::Exec`, naming the application and the system's reason. There is no chroot yet, so the application path is a host path at this step. A `clone` that fails with `EPERM` (no `CAP_SYS_ADMIN`, as in unprivileged Docker) says so and suggests `--privileged`. PID 1 writes only to stderr, or ends stdout writes with a newline; the child exits without flushing stdout.

The child's stack is a heap `Vec` of `--stack-size` bytes (`stack::StackSize`: 1 MiB to 1 GiB, default 8 MiB). The zeroed allocation is lazily committed, so untouched pages cost nothing. The child runs only the crate's own non-recursive code, and `tests/stack.sh` measures the depth it reaches (16 KiB in a debug build, 12 to 16 KiB in release) and fails above 64 KiB. This is measured and tested, not proved: there is no guard page, so an overflow is not guaranteed to fault. A guard page would need four more `unsafe` calls (`mmap`, `mprotect`, `munmap`, `from_raw_parts_mut`), and the constraint allows one. So the stack bound is recorded as assumption A1 in `clone.rs` and as an accepted risk in design.md's "Constraint for the plan".

**Tests**

```rust
#[test]
fn a_signal_maps_to_128_plus_the_signal_number() {
    let status = Status::from_wait(WaitStatus::Signaled(pid(2), Signal::SIGKILL, false));

    assert_eq!(status.unwrap().code(), 137);
}
```

- `Exited(_, 7)` gives 7; `Stopped` and `Continued` give `None`.
- `clone::Error::Clone(Errno::EPERM)` displays with the `--privileged` hint, and `Clone(Errno::ENOMEM)` without it.
- `only_thread()` returns `Err(Threads)` while the test holds a second thread alive.
- `spawn` is never called from `cargo test`, which runs tests on several threads. `only_thread` would refuse there, and that refusal is correct.
- By hand as root, `bcdocker run /tmp /bin/sh -c 'echo $$'` prints `2`, and `... 'exit 7'` exits 7.
- A missing application gives a message naming it; a non-executable file (`/etc/passwd`) likewise.
- The host's hostname and mounts are unchanged afterward.
- Under unprivileged Docker the `clone` error carries the `--privileged` hint.

**Implementation Outline**

```rust
// clone.rs: allocate the stack (lazily committed), then the single unsafe call.
// This sketch is the plan's original; `src/clone.rs` is authoritative. It adds `stack::StackSize`
// (so the stack length comes from `run`), the measured basis for A1, and the `CLONE_FLAGS` discussion.

//! The only module allowed to use `unsafe`.
//!
//! # Invariants
//!
//! The audit covers glibc only (`target_env = "gnu"`, glibc 2.36 on Debian bookworm);
//! musl and Android were not audited.
//!
//! I1 (one thread): `spawn` calls `clone` only after `only_thread()` has seen exactly one
//!    entry in a procfs `/proc/self/task`, and runs no code between the two that can create
//!    a thread (moves of locals and, inside `only_thread`, one `ReadDir` drop; see I5).
//! I2 (flags): every clone uses `CLONE_FLAGS`; callers cannot choose flags.
//! I3 (stack): every clone uses a fresh heap `Vec` of `STACK` = 8 MiB bytes, alive in the
//!    parent until `clone` returns. It has no guard page, by the one-`unsafe` constraint;
//!    see A1.
//! I4 (callback): the only closure cloned is built here, from `&Run`, and calls
//!    `supervise::container_main`. No safe caller can change what the child runs.
//! I5 (allocator): this crate declares no `#[global_allocator]`; allocation is glibc malloc,
//!    which never creates threads.
//! A1 (ASSUMPTION, not proved; design.md "Constraint for the plan"): the child's stack use
//!    stays below `STACK`. Evidence only: see E5 in `spawn`.

const CLONE_FLAGS: CloneFlags = CloneFlags::CLONE_NEWPID
    .union(CloneFlags::CLONE_NEWNS)
    .union(CloneFlags::CLONE_NEWUTS)
    .union(CloneFlags::CLONE_NEWIPC);
const STACK: usize = 8 << 20;

/// Runs `supervise::container_main(run)` as PID 1 of new PID, mount, UTS and IPC
/// namespaces and returns its host PID.
///
/// Sound for every safe caller, given assumption A1: callers cannot choose clone flags,
/// the stack, or the closure, `run`'s sizes do not affect the child's stack depth, and
/// the call fails (without cloning) unless the process has exactly one thread.
/// The child runs in a copy of this process's memory. The closure, and `run`, stay valid
/// there until the child exits and are never dropped there. In this process the closure
/// is dropped exactly once, before `spawn` returns. The child's exit status is
/// `container_main`'s return value, truncated to 8 bits.
pub fn spawn(run: &Run) -> Result<Pid, Error> {
    let child: CloneCb<'_> = Box::new(move || supervise::container_main(run) as isize);
    let mut stack = vec![0u8; STACK];
    only_thread()?;
    // SAFETY:
    // Operation: `nix::sched::clone(child, &mut stack, CLONE_FLAGS, Some(SIGCHLD))`, nix =0.31.3
    // (audited src/sched.rs: calls libc `clone(callback, (end of stack) - (end % 16),
    // CLONE_FLAGS | SIGCHLD, &mut child)` with no ptid/tls/ctid; `callback` is a Rust
    // `extern "C" fn` calling `(*child)()`).
    // Required contract:
    //  C1 (nix # Safety) the child must not overflow `stack`.
    //  C2 (nix # Safety, via `fork`) in a multithreaded process the child may call only
    //     async-signal-safe functions until execve.
    //  C3 (nix source) `stack.len() >= 16`, so its alignment arithmetic stays in bounds.
    //  C4 (clone(2) + nix source) the flag word must exclude CLONE_SETTLS,
    //     CLONE_PARENT_SETTID, CLONE_CHILD_SETTID, CLONE_CHILD_CLEARTID and CLONE_PIDFD,
    //     whose arguments nix does not pass.
    //  C5 (CloneCb<'_> vs clone(2)) `child`, the data it borrows, and nix's frame holding
    //     `&mut child` stay allocated in the child while it runs; `child` is dropped at
    //     most once per address space.
    //  C6 a panic in `child` must not unwind through the libc frame.
    // Evidence:
    //  E1 (I2, LOCAL FACT) CLONE_FLAGS is NEWPID|NEWNS|NEWUTS|NEWIPC: none of the C4 flags, and
    //     not CLONE_VM, CLONE_FILES or CLONE_FS. SIGCHLD (17) lies within the CSIGNAL byte
    //     0xff, so OR-ing it adds no flag. => C4.
    //  E2 (DEPENDENCY LEMMA, clone(2), glibc 2.36) without CLONE_VM the child runs in a
    //     separate copy of this address space at the same addresses, so `child`, `&Run`
    //     and nix's frame exist unchanged there. "When fn returns, the child process
    //     terminates" (clone(2)), so the child never resumes a frame above `callback` and
    //     never frees them. Writes in either process are invisible to the other, so the
    //     parent's drop of `child` (once, when nix's `clone` returns) and of `stack` do not
    //     affect the child. => C5.
    //  E3 (I1, safety-usable invariant of `only_thread`; I5) the process had exactly one
    //     thread when `only_thread` read procfs. A thread is created only by a thread of
    //     this process (clone(2)), and since then this thread has only dropped a `ReadDir`
    //     (glibc `free`, I5) and moved locals, so it still has one. C2's antecedent is
    //     false, and the child may allocate, lock, format and print. Locks this thread
    //     holds further up the stack (a std `Mutex`, a `OnceLock` init, the stdout lock)
    //     are copied as held; relocking them can deadlock or panic (std docs), which is
    //     not UB, and none is held on `launch`'s path.
    //  E4 (I3, LOCAL FACT) `stack.len() == STACK == 8 MiB >= 16`. => C3.
    //  E5 (ASSUMPTION A1; evidence, NOT proof) the child runs only `container_main`, crate
    //     code with no recursion (I4), plus std's `Command::spawn`, fs and formatting, which
    //     std runs routinely on its documented 2 MiB thread stacks; 8 MiB is 4x that.
    //     There is no guard page, so an overflow is not guaranteed to fault. No safe caller
    //     can raise the child's stack depth. C1 is NOT discharged; it rests on A1, accepted
    //     in design.md.
    //  E6 (AXIOM, Reference, rustc >= 1.81, and Cargo.toml has `rust-version = "1.96"`: a panic
    //     that would unwind out of a Rust-defined `extern "C"` function aborts) nix's
    //     `callback` is such a function. => C6.
    // Postconditions:
    //  Ok(pid): the child is PID 1 of new namespaces, running `child` on its copy of
    //   `stack`; the caller must reap `pid`. Here, `child` has been dropped once and
    //   `stack` is freed when it goes out of scope.
    //  Err(e): no child exists (clone(2) returned -1), and `child` was dropped once, here.
    let pid = unsafe { nix::sched::clone(child, &mut stack, CLONE_FLAGS, Some(Signal::SIGCHLD as c_int)) };
    pid.map_err(Error::Clone)
}

/// # Safety-usable invariant
///
/// Returns `Ok(())` only if `/proc/self/task` is on procfs (`statfs` reports
/// `PROC_SUPER_MAGIC`) and lists exactly one thread at the time of the read. Any other
/// outcome, including I/O errors, is `Err`.
fn only_thread() -> Result<(), Error> {
    match nix::sys::statfs::statfs("/proc/self/task") {
        Ok(fs) if fs.filesystem_type() == nix::sys::statfs::PROC_SUPER_MAGIC => {}
        _ => return Err(Error::Threads),   // not procfs, or unreadable: refuse
    }
    match std::fs::read_dir("/proc/self/task").map(|d| d.count()) {
        Ok(1) => Ok(()),
        _ => Err(Error::Threads),   // more than one thread, or /proc unreadable: refuse
    }
}

// launch.rs
let pid = clone::spawn(run)?;
loop { if let Some(s) = Status::from_wait(waitpid(pid, None).map_err(Wait)?) { return Ok(s) } }

// supervise.rs
pub fn container_main(run: &Run) -> i32 {
    match supervise(run) {
        Ok(status) => status.code().into(),
        Err(e) => { eprintln!("bcdocker: {e}"); 1 }
    }
}
fn supervise(run: &Run) -> Result<Status, supervise::Error> {
    let child = Command::new(&run.app).args(&run.args).spawn()
        .map_err(|source| Exec { app: run.app.clone(), source })?;
    let app = Pid::from_raw(child.id() as i32);
    loop { if let Some(s) = Status::from_wait(waitpid(app, None).map_err(Wait)?) { return Ok(s) } }   // Step 5 waits for any child
}
```

## Step 4: Container filesystem, hostname, and `/proc`

**Enables:** `host=bctest`, `hostfs=sealed`, `seen=1,2`, and `init=bcdocker`. The root listing, no leftover mounts, the unchanged host hostname, and the empty rootfs `/proc` already pass after Step 3 and must keep passing. After this step the feature test passes.

`sandbox::enter` runs first in `supervise`, before the application starts, in this order: make `/` private and recursive; set the hostname; bind-mount the rootfs onto itself; mount a fresh `proc` at `<rootfs>/proc`; mount a tmpfs at `<rootfs>/dev` and create `null`, `zero`, `full`, `random`, `urandom`, and `tty`; `chdir` to the rootfs; `chroot(".")`; `chdir("/")`. Every mount lives in the private mount namespace, so nothing remains on the host. `enter` never modifies the rootfs directory itself: it mounts over `proc` and `dev` without writing to them, and the device nodes go into the tmpfs. The application can still write to the rootfs, as it would to any root filesystem. `mknod` applies the umask, so `enter` sets the umask to 0 around the device loop (`nix::sys::stat::umask`, safe) and restores it, so the nodes are mode 0666 and the application inherits the original umask.

**Tests**

The feature test is the integration test. One unit test covers the device table:

```rust
#[test]
fn the_dev_table_lists_the_six_oci_devices_with_their_numbers() {
    let table: Vec<_> = DEV_NODES.iter().map(|d| (d.name, d.major, d.minor)).collect();

    assert_eq!(table, [("null",1,3), ("zero",1,5), ("full",1,7), ("random",1,8), ("urandom",1,9), ("tty",5,0)]);
}
```

- A rootfs missing its `proc` directory gives a `Mount` error naming `/proc`.
- `/dev/null` is writable inside the container and reads empty.
- `stat -c %a /dev/null /dev/tty` inside the container prints `666` for each, even when the launcher's umask is 022.
- After a run whose application writes nothing, the rootfs `proc` and `dev` directories are as the build left them; the feature test's empty rootfs `/proc` check covers this for `proc`. It checks `enter`'s setup, not what an application writes.

**Implementation Outline**

```rust
pub fn enter(c: &Container) -> Result<(), sandbox::Error> {
    let none = None::<&str>;
    let root = c.rootfs();
    let (proc_dir, dev_dir) = (root.join("proc"), root.join("dev"));
    mount(none, "/", none, MsFlags::MS_REC | MsFlags::MS_PRIVATE, none)
        .map_err(|source| Mount { target: "/", source })?;
    sethostname(c.hostname().as_str()).map_err(Hostname)?;
    mount(Some(root), root, none, MsFlags::MS_BIND | MsFlags::MS_REC, none)
        .map_err(|source| Mount { target: "rootfs", source })?;
    mount(Some("proc"), &proc_dir, Some("proc"), MsFlags::MS_NOSUID | MsFlags::MS_NOEXEC | MsFlags::MS_NODEV, none)
        .map_err(|source| Mount { target: "/proc", source })?;
    mount(Some("tmpfs"), &dev_dir, Some("tmpfs"), MsFlags::MS_NOSUID, none)
        .map_err(|source| Mount { target: "/dev", source })?;
    let old_umask = umask(Mode::empty());   // mknod applies the umask; nodes must be 0666
    for d in &DEV_NODES {
        mknod(&dev_dir.join(d.name), SFlag::S_IFCHR, Mode::from_bits_truncate(0o666), makedev(d.major, d.minor))
            .map_err(|source| Mknod { device: d.name, source })?;
    }
    umask(old_umask);
    chdir(root).map_err(Chroot)?; chroot(".").map_err(Chroot)?; chdir("/").map_err(Chroot)?;
    Ok(())
}
// supervise.rs, first line of supervise(): sandbox::enter(&run.container)?;
```

## Step 5: Descriptor hygiene, environment, orphans, and parent death

**Enables:** design promises the feature test does not check: no inherited descriptors above 2, the `PATH` default, orphan reaping, and the container ending when the host-side process dies.

This step adds `set_pdeathsig`, `close_extra_fds`, and the reap loop to `supervise`, which then runs, in order: `set_pdeathsig`, `sandbox::enter`, `close_extra_fds`, start the application, reap. As its first act, PID 1 requests `SIGKILL` when its parent dies (`prctl` parent-death signal), so killing the host-side `bcdocker` ends the container. The parent-death signal fires when the creating thread exits (prctl(2)); by I1 that thread is the host process's only thread, its main thread. A small window remains if the parent dies before the call; the usual check of the parent pid cannot close it, because the parent pid reads 0 inside a new PID namespace. After `sandbox::enter` (so `/proc` is mounted), PID 1 lists `/proc/self/fd`, collects the numbers, then closes every descriptor above 2. At the close point no live value in the child owns an fd above 2: values in the parent's frames above `callback` were copied but are never resumed or dropped in the child (E2 in `clone.rs`). The `ReadDir` over `/proc/self/fd` is collected and dropped before the loop, and its old number gives `EBADF`, which is expected. The parent's descriptors are unaffected because `CLONE_FLAGS` excludes `CLONE_FILES` (I2). The application inherits the launcher's environment with `PATH` set to `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`. The reap loop replaces the wait on the application's pid: PID 1 waits for any child with `waitpid(None, None)` and returns when the pid matches the application's, so orphans are reaped and the application's status is not lost.

**Tests**

The checks live in a second script, `tests/hardening.sh`, run like `run.sh`. It uses the same `target/test-work` and builds the container with `mkrootfs.sh` if it is absent.

```bash
# descriptors: the host opens fd 9 on a host directory before running
# ls is a child of sh, so it lists sh's descriptors without its own directory fd
exec 9</; out=$(run bctest /bin/sh -c 'ls /proc/$$/fd')
[[ $(paste -sd, - <<<"$out") == 0,1,2 ]]
```

- `echo $PATH` inside prints the Debian default, and a host variable `FOO=bar` is visible inside.
- An orphaned grandchild leaves no zombie: `out=$(run bctest /bin/sh -c '(true &); sleep 0.2; grep -l "^State:.Z" /proc/[0-9]*/status'); [[ -z $out ]]`. The test checks for empty output and ignores the exit status, because `grep -l` exits 1 when no file matches.
- Starting `bcdocker run bctest /bin/sh -c 'sleep 30'` directly in the background with `&` (from `target/test-work`, not through `run()`, whose subshell would be `$!`) and killing bcdocker's own pid with `kill -9 $!` leaves no `sleep 30` on the host within two seconds. The kill must target the host-side `bcdocker` process itself (or use `pkill -x bcdocker` on the host), never a wrapper subshell.
- A descriptor opened with close-on-exec already set is still absent.
- The application's exit status is still correct when an orphan exits first.

**Implementation Outline**

```rust
fn supervise(run: &Run) -> Result<Status, supervise::Error> {
    set_pdeathsig(Signal::SIGKILL).map_err(Pdeathsig)?;
    sandbox::enter(&run.container)?;
    close_extra_fds().map_err(Fds)?;
    let child = Command::new(&run.app).args(&run.args).env("PATH", DEBIAN_PATH).spawn()
        .map_err(|source| Exec { app: run.app.clone(), source })?;
    let app = Pid::from_raw(child.id() as i32);
    loop {
        let w = waitpid(None, None).map_err(Wait)?;
        if w.pid() == Some(app) { if let Some(s) = Status::from_wait(w) { return Ok(s) } }
    }
}
fn close_extra_fds() -> io::Result<()> {
    let fds: Vec<RawFd> = open_fds_above(2)?;   // the ReadDir is dropped before the loop
    for fd in fds { let _ = nix::unistd::close(fd); }
    Ok(())
}
```

## Step 6: Platform and manual verification

**Enables:** the design's Metrics and Verification sections: macOS builds and declines, and the feature test and manual runs pass on both targets.

No new code beyond the lint attributes below and fixes found here. On the Mac, `cargo build` succeeds and `bcdocker run` prints the not-Linux message and exits 1.

On the Debian host or `bookworm-slim` VM, run `cargo build && sudo tests/run.sh` and `sudo tests/hardening.sh`.

On the Mac with Docker Desktop, in three parts:
1. Build the Linux binary on a Linux host or in a `rust:1-bookworm` container (`docker run --rm -v "$PWD":/src -w /src rust:1-bookworm cargo build`). Its glibc 2.36 matches `bookworm-slim`.
2. On the Mac host, run `scripts/mkrootfs.sh bctest` with Docker from `target/test-work` (`mkdir -p target/test-work && cd target/test-work && ../../scripts/mkrootfs.sh bctest`), so `target/test-work/containers/bctest` exists and is built for the Mac's architecture through the `uname -m` mapping. The test scripts then skip their own rootfs build, which would need Docker or crane inside the container.
3. Run the tests inside a privileged `debian:bookworm-slim` container with the repo bind-mounted, as root already, with no `sudo`: `docker run --rm -it --privileged -v "$PWD":/src -w /src debian:bookworm-slim tests/run.sh`, and the same with `tests/hardening.sh`.

The bind-mounted repo lives on Docker Desktop's shared filesystem (virtiofs). Whether its bind mounts, `proc` and `tmpfs` mounts, and `chroot` behave as on a native filesystem is unverified. If they fail, copy the repo, rootfs included, into the container's own filesystem and run the tests from the copy (inside the container: `cp -a /src /work && /work/tests/run.sh`).

Run by hand: Ctrl-C in an interactive `bcdocker run tinysys /bin/sh`, `bcdocker` without root, a rootfs built for the other architecture, and under Docker without `--privileged` (expect the `--privileged` hint). Force a panic in PID 1 once and record the status the host sees. Recorded on the Linux sandbox: a forced panic in PID 1 prints Rust's "panic in a function that cannot unwind", aborts, and the host sees exit 139 (not 134), as the abort in E6 predicts.

Verified in the Linux sandbox (Ubuntu 24.04, kernel 6.18, x86_64, root, real `bookworm-slim` via crane, Docker daemon unavailable): `cargo test`, `cargo clippy --all-targets`, `tests/run.sh`, `tests/hardening.sh`, `tests/mkrootfs_test.sh`; `cargo check --target aarch64-apple-darwin`; no `CAP_SYS_ADMIN` gives the `--privileged` hint; running as a non-root user gives the privilege message; an arm64 rootfs gives `Exec format error`; Ctrl-C on a pseudo-terminal ends the container with nothing left behind. Not verified: Docker Desktop on a Mac, the Debian VM, Apple silicon, and a macOS `cargo build` and run.

**Tests**

- `clone.rs` carries `#![deny(clippy::undocumented_unsafe_blocks, clippy::multiple_unsafe_ops_per_block)]`.
- `cargo clippy` and `cargo test` pass on Linux; `grep -rln 'allow(unsafe_code)\|unsafe {' src/` lists only `src/main.rs` (the single allow) and `src/clone.rs`, and `grep -c 'unsafe {' src/clone.rs` prints `1`.
- `tests/run.sh`, `tests/hardening.sh`, and `tests/stack.sh` print `ok` on both targets.
- On Apple silicon, the rootfs built by `mkrootfs.sh` is arm64 and `tests/run.sh` passes.

**Implementation Outline**

Fix whatever the runs expose.
