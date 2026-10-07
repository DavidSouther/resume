#![deny(clippy::undocumented_unsafe_blocks, clippy::multiple_unsafe_ops_per_block)]
//! The only module allowed to use `unsafe`.
//!
//! # Invariants
//!
//! The audit covers glibc only: the host's glibc at run time (bcdocker runs outside the
//! rootfs). The clone wrapper and malloc were read against 2.36 and the stack was measured on
//! 2.39. The version is not checked at run time: a glibc older than 2.34, or one not audited,
//! is outside this proof, so re-read the glibc claims in E3 and E5 after an upgrade. A musl
//! build stops at the `compile_error!` below; Android is not `target_os = "linux"`, so it
//! builds without this module and reports that it needs Linux.
//!
//! I1 (one thread): `spawn` calls `clone` only after `only_thread()` has seen exactly one
//!    entry in a procfs `/proc/self/task`, and runs no code between the two that can create
//!    a thread (moves of locals and, inside `only_thread`, the end of the directory listing
//!    and its `closedir`: `getdents64`, `close` and a glibc `free`; see I5).
//! I2 (flags): every clone uses `CLONE_FLAGS`; callers cannot choose flags.
//! I3 (stack): every clone uses a fresh heap `Vec` of `run.stack_size.bytes()` bytes, alive
//!    in the parent until `clone` returns. `StackSize` guarantees `stack::MIN` (1 MiB) <= that
//!    <= `stack::MAX`, and defaults to `stack::DEFAULT` (8 MiB). The `Vec` has no guard page:
//!    adding one needs `mmap` and `mprotect`, more `unsafe` than this module's single block;
//!    see A1.
//! I4 (callback): the only closure cloned is built here, from `&Run`, and calls
//!    `supervise::container_main`. No safe caller can change what the child runs.
//! I5 (allocator): this crate declares no `#[global_allocator]`; allocation is glibc malloc,
//!    which never creates threads.
//! A1 (ASSUMPTION, measured and tested, not proved): the child's stack use stays below
//!    `stack::MIN`, so below every accepted stack size. Its one input-dependent term, a copy
//!    of the argument array, is bounded by `cli::MAX_ARGS`, an invariant of `cli::AppArgs`.
//!    The basis is stated in E5 in `spawn`, and `tests/stack.sh` repeats the measurement.

#[cfg(not(target_env = "gnu"))]
compile_error!("the clone audit in this module covers glibc only");

use std::ffi::c_int;

use nix::{
    errno::Errno,
    sched::{clone, CloneCb, CloneFlags},
    sys::{
        signal::Signal,
        statfs::{statfs, PROC_SUPER_MAGIC},
    },
    unistd::Pid,
};

use crate::{cli::Run, supervise};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("clone: the process has more than one thread")]
    Threads,
    #[error("clone: {}{}", .0, privileged_hint(.0))]
    Clone(#[source] Errno),
    #[error(transparent)]
    Stack(#[from] crate::stack::Error),
}

fn privileged_hint(errno: &Errno) -> &'static str {
    if *errno == Errno::EPERM {
        "; under Docker, run with --privileged"
    } else {
        ""
    }
}

/// What PID 1 is cloned with: four new namespaces, and nothing shared with the parent.
/// `SIGCHLD` is added at the call, as the exit signal, so the parent can `waitpid` it.
///
/// Created, because the container needs its own view of each:
/// - `CLONE_NEWPID`: a process tree of its own, where the first process is PID 1. `ps` shows
///   only the container's processes once a procfs is mounted from inside it (pid_namespaces(7)).
/// - `CLONE_NEWNS`: a private mount table. The container mounts `/proc` and a tmpfs `/dev` and
///   changes its root, and none of that may reach the host. This is also why `sandbox::enter`
///   first makes `/` private: a new mount namespace copies the parent's propagation, which is
///   shared on systemd hosts.
/// - `CLONE_NEWUTS`: a hostname of its own, so `sethostname` does not rename the host.
/// - `CLONE_NEWIPC`: its own SysV IPC objects and POSIX message queues. It costs one flag and
///   no setup, and it keeps a container from seeing or disturbing the host's shared memory
///   segments.
///
/// Every other flag is left out. The ones worth explaining:
/// - `CLONE_NEWNET`: networking is out of scope, so the container shares the host's network.
/// - `CLONE_NEWUSER`: `bcdocker` runs as root and needs its real `CAP_SYS_ADMIN` for the
///   mounts. A user namespace would remap that, and rootless operation is out of scope.
/// - `CLONE_NEWCGROUP`, `CLONE_NEWTIME`: nothing in scope uses cgroups or a separate clock.
/// - `CLONE_VM`, `CLONE_FILES`, `CLONE_FS`, `CLONE_SIGHAND`, `CLONE_THREAD`, `CLONE_PARENT`: the
///   child is a process, not a thread. Sharing memory would break the argument in `spawn` (E2:
///   the child runs in a copy). Sharing the descriptor table would let the child's closing of
///   inherited descriptors close the parent's. `CLONE_FS` is rejected together with
///   `CLONE_NEWNS` and would share the chroot. `CLONE_THREAD` is rejected together with
///   `CLONE_NEWPID`; with `CLONE_PARENT` the child would belong to bcdocker's parent, and
///   bcdocker must stay its parent to wait for it.
/// - `CLONE_IO`: shares the disk scheduler's I/O context; it isolates nothing.
/// - `CLONE_SETTLS`, `CLONE_PARENT_SETTID`, `CLONE_CHILD_SETTID`, `CLONE_CHILD_CLEARTID`,
///   `CLONE_PIDFD`: they read arguments that nix does not pass (C4 in `spawn`).
const CLONE_FLAGS: CloneFlags = CloneFlags::CLONE_NEWPID
    .union(CloneFlags::CLONE_NEWNS)
    .union(CloneFlags::CLONE_NEWUTS)
    .union(CloneFlags::CLONE_NEWIPC);

/// Runs `supervise::container_main(run)` as PID 1 of the namespaces in `CLONE_FLAGS` and
/// returns its host PID.
///
/// Sound for every safe caller, given assumption A1: callers cannot choose clone flags, the
/// stack, or the closure; `run`'s sizes affect the child's stack depth only through the
/// argument count, which `cli::AppArgs` bounds (E5(a)); and the call fails, without cloning,
/// unless the process has exactly one thread.
///
/// The caller must `waitpid` the returned pid. The child's exit status is `container_main`'s
/// return value, truncated to 8 bits; a panic in the child gives 139 instead (see the
/// postconditions). Do not call while holding a std lock the child may also take: the child
/// inherits it held.
pub fn spawn(run: &Run) -> Result<Pid, Error> {
    let child: CloneCb<'_> = Box::new(move || supervise::container_main(run) as isize);
    let mut stack = run.stack_size.allocate()?;
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
    //  C5 (CloneCb<'_> vs clone(2)) `child`, the data it borrows, and nix's local `cb` (the
    //     moved `child`), whose address is clone's `arg`, stay allocated in the child while it
    //     runs; `child` is dropped at most once per address space.
    //  C6 a panic in `child` must not unwind through the libc frame.
    // Evidence:
    //  E1 (I2, LOCAL FACT) CLONE_FLAGS is NEWPID|NEWNS|NEWUTS|NEWIPC: none of the C4 flags, and
    //     not CLONE_VM, CLONE_FILES or CLONE_FS. SIGCHLD (17) lies within the CSIGNAL byte
    //     0xff, so OR-ing it adds no flag. => C4.
    //  E2 (DEPENDENCY LEMMA, clone(2), glibc; see the module doc) without CLONE_VM the child
    //     runs in a separate copy of this address space at the same addresses, so `child`,
    //     `&Run` and nix's frame exist unchanged there. "When the fn(arg) function returns,
    //     the child process terminates" (clone(2)): glibc's wrapper makes the raw `exit` system
    //     call, so the child never resumes a frame above `callback`, never frees them, and
    //     runs no atexit handler or thread-local destructor. Writes in either process are
    //     invisible to the other, so the parent's drop of `child` (once, when nix's `clone`
    //     returns) and of `stack` do not affect the child. => C5.
    //  E3 (I1, safety-usable invariant of `only_thread`; I5) the process had exactly one
    //     thread when `only_thread` read procfs. A thread is created only by a thread of
    //     this process (clone(2)). Since then this thread has finished the listing and
    //     dropped the `ReadDir` (`getdents64`, `close`, glibc `free`; I5) and moved locals,
    //     and the only code that can run asynchronously is std's SIGSEGV and SIGBUS handler.
    //     None of that creates a thread, so it still has one. C2's antecedent is false, and
    //     the child may allocate, lock, format and print. Locks this thread
    //     holds further up the stack (a std `Mutex`, a `OnceLock` init, the stdout lock)
    //     are copied as held; relocking them can deadlock or panic (std docs), which is
    //     not UB.
    //     Unlike fork(3), glibc's clone() runs no atfork handlers and leaves the cached thread
    //     ID in the thread control block as the parent's. No glibc-internal lock is held: the
    //     only thread is not inside glibc at the call, which is reached by plain calls from
    //     `main`, not from a signal handler or a glibc callback. Nothing the child reaches
    //     reads the cached ID: std's locks use futexes and a thread-local ThreadId, raise and
    //     abort ask the kernel (gettid), and Command::spawn sets up its own child through
    //     fork or posix_spawn. These glibc facts hold from 2.34 on.
    //  E4 (I3, LOCAL FACT) `stack.len() == run.stack_size.bytes()` by `StackSize::allocate`,
    //     and `>= stack::MIN = 1 MiB` by the `StackSize` type, so `>= 16`. => C3.
    //  E5 (ASSUMPTION A1; measured and tested, NOT proved) the child's stack use stays below
    //     `stack::MIN` = 1 MiB, so below any accepted size (I3). Basis:
    //     (a) the child runs only `container_main`: crate code with no recursion and no large
    //         locals (I4). Paths, arguments, the environment and error text live on the heap,
    //         and nix's path buffers are fixed at 1024 bytes, so the size of the input changes
    //         only which bounded path runs (one page in release, per (b)). One term grows with
    //         the input: for an application named without a `/`, std forks PID 1 and glibc's
    //         `execvp` runs it there, and if the file is not an executable format, `execvp`
    //         retries through `/bin/sh` with a copy of the argument array on the fork's copy
    //         of this stack, (arguments + 3) * 8 bytes. `cli::AppArgs` caps the arguments at
    //         `cli::MAX_ARGS` = 16384, so that copy is at most about 128 KiB, an eighth of
    //         `stack::MIN`;
    //     (b) measured depth of the child's stack for the whole path (`sandbox::enter`,
    //         `close_extra_fds`, `Command::spawn`, the wait): 16 KiB in a debug build and
    //         12 to 16 KiB in release, on x86_64, glibc 2.39, rustc 1.97 (2026-10-07). The
    //         depth is the same at the 8 MiB default and the 1 MiB floor, and with 2000
    //         arguments plus a 100 KB environment it is the same in debug and one 4 KiB page
    //         (the measurement's granularity) deeper in release. `stack::MIN` is 64x the debug
    //         figure, the default 512x;
    //     (c) `tests/stack.sh` repeats (b) on any machine and fails above 64 KiB (hard-coded
    //         there as `stack::MIN / 16`), four times the debug figure, so growth fails a test
    //         long before it nears the floor. On a floor-sized stack it also runs the
    //         failing-exec path, which formats a long path into an error, and the `execvp`
    //         retry of (a) with `cli::MAX_ARGS` arguments.
    //     Not shown: other architectures or libc versions (run `tests/stack.sh` on each target
    //     and after toolchain upgrades), and a proof for every path. Where the stack lies is
    //     glibc malloc behaviour, not a guarantee: a block of 1 MiB or more gets its own
    //     `mmap` unless freeing a block that large has raised malloc's mmap threshold, and
    //     nothing bcdocker frees before allocating the stack is that large (measured: PID 1's
    //     stack pointer is in an anonymous mapping, not `[heap]`, at 1 MiB and 8 MiB). That
    //     mapping can sit directly above another, and there is no guard page, so an overflow
    //     is not guaranteed to fault. C1 is NOT discharged; it rests on A1 (module doc).
    //  E6 (AXIOM, Reference, rustc >= 1.81, and Cargo.toml's `rust-version` is at least that:
    //     a panic that would unwind out of a Rust-defined `extern "C"` function aborts) nix's
    //     `callback` is such a function. => C6.
    // Postconditions:
    //  Ok(pid): the child is PID 1 of new namespaces, running `child` on its copy of
    //   `stack`; the caller must reap `pid`. Here, `child` has been dropped once and
    //   `stack` is freed when it goes out of scope. A panic in the child aborts it (E6); PID 1
    //   ignores its own SIGABRT, so glibc's `abort` ends in a SIGSEGV, and the host sees
    //   status 139.
    //  Err(e): no child exists (clone(2) returned -1), and `child` was dropped once, here.
    let pid = unsafe { clone(child, &mut stack, CLONE_FLAGS, Some(Signal::SIGCHLD as c_int)) };
    pid.map_err(Error::Clone)
}

/// # Safety-usable invariant
///
/// Returns `Ok(())` only if `/proc/self/task` is on procfs (`statfs` reports
/// `PROC_SUPER_MAGIC`) and lists exactly one thread at the time of the read. Any other
/// outcome, including I/O errors, is `Err`.
fn only_thread() -> Result<(), Error> {
    match statfs("/proc/self/task") {
        Ok(fs) if fs.filesystem_type() == PROC_SUPER_MAGIC => {}
        _ => return Err(Error::Threads),
    }
    match std::fs::read_dir("/proc/self/task").map(|d| d.count()) {
        Ok(1) => Ok(()),
        _ => Err(Error::Threads),
    }
}

#[cfg(test)]
mod tests {
    use std::assert_matches;

    use super::*;

    #[test]
    fn a_denied_clone_suggests_privileged_and_other_failures_do_not() {
        assert!(Error::Clone(Errno::EPERM).to_string().contains("--privileged"));
        assert!(!Error::Clone(Errno::ENOMEM).to_string().contains("--privileged"));
    }

    #[test]
    fn the_clone_flags_are_the_four_namespaces_and_no_sharing() {
        let namespaces = CloneFlags::CLONE_NEWPID
            | CloneFlags::CLONE_NEWNS
            | CloneFlags::CLONE_NEWUTS
            | CloneFlags::CLONE_NEWIPC;
        let ruled_out = CloneFlags::CLONE_VM
            | CloneFlags::CLONE_FS
            | CloneFlags::CLONE_FILES
            | CloneFlags::CLONE_SIGHAND
            | CloneFlags::CLONE_THREAD
            | CloneFlags::CLONE_PARENT
            | CloneFlags::CLONE_IO
            | CloneFlags::CLONE_NEWNET
            | CloneFlags::CLONE_NEWUSER
            | CloneFlags::CLONE_NEWCGROUP;

        // nix's `CloneFlags` cannot name CLONE_SETTLS, the *_SETTID flags, CLONE_CHILD_CLEARTID
        // or CLONE_PIDFD, so those (C4 in `spawn`) cannot be in `CLONE_FLAGS` at all.
        assert_eq!(CLONE_FLAGS, namespaces);
        assert!(!CLONE_FLAGS.intersects(ruled_out));
    }

    // libtest runs its own threads, so this checks only that `only_thread` refuses while threads
    // exist; the one-thread case is covered by the end-to-end tests.
    #[test]
    fn only_thread_refuses_while_another_thread_is_alive() {
        let (stop, parked) = std::sync::mpsc::channel::<()>();
        let helper = std::thread::spawn(move || {
            let _ = parked.recv();
        });

        let result = only_thread();

        assert_matches!(result, Err(Error::Threads));
        drop(stop);
        helper.join().unwrap();
    }
}
