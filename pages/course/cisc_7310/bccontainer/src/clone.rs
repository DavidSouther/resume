#![deny(clippy::undocumented_unsafe_blocks, clippy::multiple_unsafe_ops_per_block)]
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
//! I3 (stack): every clone uses a fresh heap `Vec` of `run.stack_size.bytes()` bytes, alive
//!    in the parent until `clone` returns. `StackSize` guarantees `stack::MIN` (1 MiB) <= that
//!    <= `stack::MAX`, and defaults to `stack::DEFAULT` (8 MiB). The `Vec` has no guard page,
//!    by the one-`unsafe` constraint; see A1.
//! I4 (callback): the only closure cloned is built here, from `&Run`, and calls
//!    `supervise::container_main`. No safe caller can change what the child runs.
//! I5 (allocator): this crate declares no `#[global_allocator]`; allocation is glibc malloc,
//!    which never creates threads.
//! A1 (ASSUMPTION, measured and tested, not proved; design.md "Constraint for the plan"): the
//!    child's stack use stays below `stack::MIN`, so below every accepted stack size. The
//!    basis is stated in E5 in `spawn`, and `tests/stack.sh` repeats the measurement.

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
/// - `CLONE_NEWPID`: a process tree of its own, where the first process is PID 1. This is the
///   assignment's "process IDs start from 1" and the lecture's minimum. `ps` shows only the
///   container's processes once a procfs is mounted from inside it (pid_namespaces(7)).
/// - `CLONE_NEWNS`: a private mount table. The container mounts `/proc` and a tmpfs `/dev` and
///   changes its root, and none of that may reach the host. This is also why `sandbox::enter`
///   first makes `/` private: a new mount namespace still starts with shared propagation.
/// - `CLONE_NEWUTS`: a hostname of its own, so `sethostname` does not rename the host. This is
///   the lecture's second required namespace.
/// - `CLONE_NEWIPC`: its own SysV IPC objects and POSIX message queues. The assignment does not
///   need it. It costs one flag and no setup, and it keeps a container from seeing or
///   disturbing the host's shared memory segments.
///
/// Left out on purpose:
/// - `CLONE_NEWNET`: networking is out of scope, so the container shares the host's network.
/// - `CLONE_NEWUSER`: `bcdocker` runs as root and needs its real `CAP_SYS_ADMIN` for the
///   mounts. A user namespace would remap that, and rootless operation is out of scope.
/// - `CLONE_NEWCGROUP`, `CLONE_NEWTIME`: nothing in scope uses cgroups or a separate clock.
///   `CLONE_NEWCGROUP` arrives with `--memory` and `--pids-limit`.
/// - `CLONE_VM`, `CLONE_FILES`, `CLONE_FS`, `CLONE_SIGHAND`, `CLONE_THREAD`, `CLONE_PARENT`: the
///   child is a process, not a thread. Sharing memory would break the argument in `spawn` (E2:
///   the child runs in a copy). Sharing the descriptor table would let the child's closing of
///   inherited descriptors close the parent's (I2). `CLONE_FS` is rejected together with
///   `CLONE_NEWNS` and would share the chroot. `CLONE_THREAD` and `CLONE_PARENT` are rejected
///   together with `CLONE_NEWPID`, and the parent must stay the child's parent to wait for it.
/// - `CLONE_IO`: shares the disk scheduler's I/O context. It isolates nothing and does not
///   redirect stdin, stdout, or stderr.
/// - `CLONE_SETTLS`, `CLONE_PARENT_SETTID`, `CLONE_CHILD_SETTID`, `CLONE_CHILD_CLEARTID`,
///   `CLONE_PIDFD`: they read arguments that nix does not pass (C4 in `spawn`).
const CLONE_FLAGS: CloneFlags = CloneFlags::CLONE_NEWPID
    .union(CloneFlags::CLONE_NEWNS)
    .union(CloneFlags::CLONE_NEWUTS)
    .union(CloneFlags::CLONE_NEWIPC);

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
    let mut stack = vec![0u8; run.stack_size.bytes()];
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
    //  E4 (I3, LOCAL FACT) `stack.len() == run.stack_size.bytes() >= stack::MIN = 1 MiB`, by
    //     the `StackSize` type, so `>= 16`. => C3.
    //  E5 (ASSUMPTION A1; measured and tested, NOT proved) the child's stack use stays below
    //     `stack::MIN` = 1 MiB, so below any accepted size (I3). Basis:
    //     (a) the child runs only `container_main`: crate code with no recursion and no large
    //         locals (I4). Everything of variable size (paths, arguments, environment, error
    //         text) lives on the heap, so the stack depth does not depend on the input;
    //     (b) measured depth of the child's stack for the whole path (`sandbox::enter`,
    //         `close_extra_fds`, `Command::spawn`, the wait): 16 KiB in a debug build and
    //         12 KiB in release, on x86_64, glibc 2.39, rustc 1.97 (2026-10-07). The depth is
    //         the same at the 8 MiB default and the 1 MiB floor, and with 2000 arguments plus
    //         a 100 KB environment. `stack::MIN` is 64x the debug figure, the default 512x;
    //     (c) `tests/stack.sh` repeats (b) on any machine and fails above `stack::MIN / 16` =
    //         64 KiB, four times the debug figure, so growth fails a test long before it
    //         nears the floor. It also runs the
    //         failing-exec path, which formats a long path into an error, on a floor-sized stack.
    //     Not shown: other architectures or libc versions (run `tests/stack.sh` on each target),
    //     and a proof for every path. There is no guard page, so an overflow is not guaranteed
    //     to fault. C1 is NOT discharged; it rests on A1, accepted in design.md.
    //  E6 (AXIOM, Reference, rustc >= 1.81, and Cargo.toml has `rust-version = "1.96"`: a panic
    //     that would unwind out of a Rust-defined `extern "C"` function aborts) nix's
    //     `callback` is such a function. => C6.
    // Postconditions:
    //  Ok(pid): the child is PID 1 of new namespaces, running `child` on its copy of
    //   `stack`; the caller must reap `pid`. Here, `child` has been dropped once and
    //   `stack` is freed when it goes out of scope.
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
        _ => return Err(Error::Threads), // not procfs, or unreadable: refuse
    }
    match std::fs::read_dir("/proc/self/task").map(|d| d.count()) {
        Ok(1) => Ok(()),
        _ => Err(Error::Threads), // more than one thread, or /proc unreadable: refuse
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
