# Unsafe Rust re-review: the revised clone boundary

*Rubric: Google rust-skills `unsafe_rust_review/SKILL.md`, used only as a review rubric. Reviewer: fresh and isolated. This verdict was formed before reading `2026-10-07-unsafe-rust-review.md`, which was then used only to check that its findings are discharged. Nothing else was edited.*

*Inputs: plan.md Step 0 (`spawn(run: &Run) -> Result<Pid, clone::Error>`), the Step 3 prose and `clone.rs` sketch (FLAGS, `only_thread`, the 8 MiB `Vec` stack, the single `unsafe { nix::sched::clone(...) }`, I1 to I4, C1 to C6, E1 to E6, postconditions), Step 5 (`set_pdeathsig`, `close_extra_fds`), design.md "Constraint for the plan", and nix 0.31.3 `src/sched.rs` (`CloneCb`, `clone`), `src/unistd.rs` (`fork`'s `# Safety`, `close`), `src/sys/prctl.rs`, `src/sys/statfs.rs`.*

## Verdict

The revision fixes the structural defect. `spawn` no longer takes flags or a closure, so every input that reaches the `unsafe` call is fixed inside `clone.rs`, and the only caller-supplied input is a `&Run` with no interior mutability. Five of the six obligations are discharged by classified premises. **C1 (stack overflow) is not discharged.** E5 says so plainly ("evidence, not proof"), which the rubric requires, but three places still claim more than the proof gives:

- the `=> C1` arrow in E5;
- the doc line "Safe to call";
- design.md, which does not record the accepted risk at all.

Two premises that the proof relies on are not stated:

- **E6** holds only on rustc 1.81 or later. Nothing pins that.
- **E3** holds only while the global allocator creates no threads. No invariant says so.

Both are one-line fixes and must be made. With them, and with C1 relabelled as a named assumption, the boundary is acceptable under the user's one-`unsafe` constraint, as a documented trade-off. One alternative discharges C1 with the same single `unsafe` call: a safe `unshare`, then `fork` (see R3). It changes the design's "one `clone`" wording, so the user decides.

## The contract, re-derived from nix 0.31.3

`nix::sched::clone(mut cb: CloneCb, stack: &mut [u8], flags: CloneFlags, signal: Option<c_int>)`. Its `# Safety` section says the child must not overflow `stack` and points to `fork` for "additional safety concerns". `fork`'s `# Safety` section says: "In a multithreaded program, only async-signal-safe functions ... may be called by the child ... until a call of `execve(2)`. Note that memory allocation may **not** be async-signal-safe". In the source, `ptr = stack.as_mut_ptr().add(stack.len())` and then `ptr.sub(ptr as usize % 16)`, so a slice shorter than 15 bytes can step outside the allocation. The source then calls `libc::clone(transmuted callback, ptr_aligned, flags.bits() | signal, &mut cb)` with no `ptid`, `tls` or `ctid`. `callback` is a Rust `extern "C" fn` that does `&mut *data` and `(*cb)() as c_int`. `cb` is dropped when nix's frame returns.

That yields exactly the plan's C1 to C6. Nothing is missing from the list. The table checks each obligation's evidence.

| # | Obligation | Evidence in the plan | Classification check | Status |
|---|---|---|---|---|
| C1 | The child must not overflow `stack`. | E5: 8 MiB is 4x std's documented 2 MiB thread default. The child runs only crate code with no recursion, plus std. | The 2 MiB figure is AXIOM (std `thread` docs). "std's `Command::spawn`, fs and formatting fit in 2 MiB" is evidence, because std documents no stack bounds. "No recursion" is a LOCAL FACT about code not shown, and it is unmeasured. | **Not discharged. Correctly called evidence, but still marked `=> C1`.** See R3. |
| C2 | Multithreaded means only async-signal-safe code until `execve`. | E3: `only_thread()` saw 1. Only a running thread can create a thread. Building `child` and `stack` creates none. | "Creates none" depends on the global allocator, which no invariant fixes. The `ReadDir` drop inside `only_thread` also happens after the observation. `only_thread` has no `# Safety-usable invariant` doc. The premise "`/proc` is procfs" is implicit. | **Discharged, given two unstated premises.** See R2 and R4. |
| C3 | `stack.len() >= 16` | E4: `STACK` is a const, 8 MiB. | LOCAL FACT plus TYPE FACT (const). | **Discharged.** |
| C4 | No SETTLS, PARENT_SETTID, CHILD_SETTID, CHILD_CLEARTID or PIDFD flag. | E1: `FLAGS` is a module const. | LOCAL FACT (I2). It does not say that `SIGCHLD` (17) falls only in the CSIGNAL byte (`0xff`), so OR-ing it adds no flag bit. | **Discharged.** Add one clause (R6). |
| C5 | `child`, `&Run` and nix's frame stay live in the child. Drop happens at most once per address space. | E2: no `CLONE_VM` means a copy at the same addresses. The child never resumes a frame above `callback`. | clone(2) is a platform contract. The rubric has no "PLATFORM LEMMA" class; use DEPENDENCY LEMMA (Linux man-pages, glibc 2.36). "glibc's trampoline exits" is a glibc implementation fact, while clone(2) documents the same thing for the wrapper: "When the fn(arg) function returns, the child process terminates". Cite that instead. The `cfg(target_os = "linux")` gate admits musl and Android, which were not audited. | **Discharged.** Citation and configuration fixes in R5. |
| C6 | A panic must not unwind through the glibc frame. | E6: the Reference says unwinding out of a Rust `extern "C"` fn aborts. | This is AXIOM only since Rust 1.81. Before 1.81 it was undefined behavior. nix declares `rust-version = "1.69"`, and the plan's `Cargo.toml` declares none. | **Discharged only on rustc ≥ 1.81, which nothing enforces.** See R1. |

Postconditions are stated for `Ok` and `Err`, and they match the source. In the parent, nix's frame drops `cb` once. `Err` means `clone` returned -1, so no child exists (clone(2)). The exit status is the `i32` cast to `isize`, then to `c_int`, then masked to 8 bits by the kernel; the doc states this. Good.

### The other checks requested

- **Single thread.** It is checked dynamically. The check fails closed, both on a count above 1 and on an unreadable `/proc`, and nothing between the check and the call can run caller code. It is not airtight on two points: the allocator (R2) and a fake `/proc` (R4).
- **Flags.** They are fixed (I2). Callers cannot reach them. `CloneFlags` is not reconstructible from outside, because `FLAGS` is a private const. Discharged.
- **Closure ownership across the clone.** The closure is built in `clone.rs` and captures only `run: &Run`. `Run` contains `Container`, `String` and `Vec<String>`, so it has no `UnsafeCell` (TYPE FACT), and the copy cannot be changed through the shared borrow. In the parent it is dropped once. In the child it is never dropped: a leak at process exit, which is acceptable. Discharged.
- **Panics in the child.** They abort (E6). This requires R1. Step 6 records the status the host actually sees. That matches the earlier review's UR-9 (PID 1 ignores its own SIGABRT, so expect 132 or 139, not 134). No undefined behavior.
- **Exit path.** The child terminates when `fn` returns (clone(2)). No atexit handlers run, no TLS destructors run, and stdout is not flushed. The plan notes this, and none of it affects soundness.
- **Is `spawn` sound for all safe callers?** Only conditionally. No input to `spawn` can cause undefined behavior: `Run` strings with NUL fail inside `Command`, and their lengths live on the heap, not the child's stack. Reentrancy is also fine. Calling `spawn` while this thread holds a std `Mutex`, a `OnceLock` init, or the stdout lock gives the child a copy of a lock the current thread holds. std documents that relocking can deadlock or panic, which is not undefined behavior. But soundness still rests on C1's unproven bound, on R1 and on R2. "Safe to call" is therefore a claim conditional on assumption A1, not a theorem (R3).

## Findings, ranked

### Must fix (Medium)

**R1. E6 is an axiom only on rustc ≥ 1.81, and nothing pins the toolchain.**
Before Rust 1.81, a panic that unwound out of an `extern "C"` function was undefined behavior. The abort guarantee E6 cites is the Reference's text as of 1.81. nix declares `rust-version = "1.69"`, so a 1.69 to 1.80 toolchain compiles this crate. On such a toolchain, a panic in PID 1 unwinds into glibc's frame. `eprintln!` alone panics if stderr is closed, so this path is reachable from the environment, not only from bugs.
Fix: add `rust-version = "1.81"` to `[package]` in Step 0's `Cargo.toml` and cite it in E6. As an alternative or addition, set `panic = "abort"` in `[profile.dev]` and `[profile.release]` (`cargo test` ignores it, and `spawn` never runs under test).

**R2. E3's "building `child` and `stack` creates none" depends on an allocator invariant that is not stated.**
`Box::new` and `vec![0u8; STACK]` (calloc) both go through the global allocator, and so does the `ReadDir` drop that happens inside `only_thread` after the count. glibc malloc never creates threads. Some allocators do: jemalloc's `background_thread`, for one. A later `#[global_allocator]` would silently falsify E3, and with it C2.
Fix: (a) add invariant **I5 (allocator): the crate declares no `#[global_allocator]`, so allocation is glibc malloc, which creates no threads**. (b) Move the two allocations *before* `only_thread()`, so the only code between the check and the call is moving two locals. The `ReadDir` drop still sits between the observation and the call; I5 covers it.

### Accepted trade-off, with the wording fixed (Medium)

**R3. C1 is not discharged. The text half-admits this and then claims it anyway.**
Under the rubric, tests, measurement and margins are confidence, not proof (reject pattern 3). Stack usage of std code has no AXIOM, and a guard page would not fully discharge C1 either. It turns an overflow into a fault only if every frame probes its stack, and C code such as glibc does not. So no wording can make C1 "discharged" here. What the rubric does require is that an undischarged premise be named, classified as an assumption, and not presented as a conclusion. E5 is honest in its body. But `=> C1, as a bound, not a guarantee`, the doc line "Safe to call", and the absence of any entry in design.md each read as a discharge.

There is a mitigating fact that the text should state: **no safe caller can influence the child's stack depth.** The closure is fixed (I4), and `Run`'s sizes live on the heap. The risk is therefore a property of the crate's own code. It is not a hidden obligation on safe callers, so it does not violate rubric rule 7. That is why it is acceptable as a documented trade-off, rather than requiring `spawn` to become `unsafe fn`.

Fix the wording:
1. Rename E5 to **A1 (ASSUMPTION, not proved)**. Drop the `=> C1` arrow and say "C1 rests on A1".
2. Make the `spawn` doc say that it is sound given A1.
3. Add the accepted risk to design.md's "Constraint for the plan".

Cheap, safe-code ways to strengthen the evidence:
1. Record a measured high-water mark. Before the call, pass `stack.as_ptr() as usize` (safe) into the closure. Have a debug-only check in PID 1 read `/proc/self/smaps` and report the `Rss` of the mapping containing that address. glibc serves an 8 MiB calloc with its own `mmap`, so `Rss` counts the touched stack pages. Record the figure in E5 next to "4x".
2. Raise `STACK` to 32 MiB or 64 MiB. The pages are committed lazily, so this costs nothing, but it remains evidence, not proof.

Option to discharge C1 with the same single `unsafe` call (the user decides; this changes design.md's "created by one `clone`"):

```rust
pub fn spawn(run: &Run) -> Result<Pid, Error> {
    unshare(CloneFlags::CLONE_NEWPID).map_err(Error::Unshare)?;   // safe: only the next child enters the new PID ns
    only_thread()?;
    // SAFETY: Operation `nix::unistd::fork()`. Contract: C2 only. Evidence: E3 + I5.
    // No stack, flags, closure, or extern "C" frame is involved, so C1 and C3 to C6 do not arise.
    match unsafe { nix::unistd::fork() }.map_err(Error::Clone)? {
        ForkResult::Parent { child } => Ok(child),
        ForkResult::Child => {
            let code = std::panic::catch_unwind(AssertUnwindSafe(|| {
                unshare(CloneFlags::CLONE_NEWNS | CloneFlags::CLONE_NEWUTS | CloneFlags::CLONE_NEWIPC)
                    .map_or(1, |()| supervise::container_main(run))
            })).unwrap_or(101);
            std::process::exit(code)   // never returns into launch/main in the child
        }
    }
}
```

The child runs on its copy of the main-thread stack, which has the kernel's guard gap and std's main-thread overflow handling: the same baseline every safe Rust program relies on. That removes C1 instead of assuming it away. glibc's `fork` also runs atfork handlers and refreshes the cached TID. Trade-offs:
- The parent's later children also land in the new PID namespace. This is harmless, because `spawn` runs once.
- A panic in the child must be caught before it unwinds into the child's copy of `launch` and `main`. `catch_unwind` above, or `panic = "abort"`, does that.
- The assignment's recipe names `clone`.

### Low

**R4. `only_thread` is a safe helper the proof relies on, but it has no documented contract, and its premise that `/proc` is procfs is implicit.** The rubric requires a `/// # Safety-usable invariant` section on such helpers. If `/proc` is a plain directory, a fake `self/task` holding one entry passes the check. This is a host-environment threat, not a safe-caller one, but it is cheap to close. Fix: check `nix::sys::statfs::statfs("/proc/self/task")?.filesystem_type() == PROC_SUPER_MAGIC` first. That call is safe, and the module is enabled by the `fs` feature the plan already has. Document the helper (wording below).

**R5. Citation and configuration matrix.** Cite clone(2) for "the child terminates when `fn` returns", not glibc's trampoline. Call the clone(2) and glibc facts DEPENDENCY LEMMA (man-pages; glibc 2.36, Debian bookworm), because "PLATFORM LEMMA" is not a rubric class. The audit covered glibc only, yet `cfg(target_os = "linux")` also admits `linux-musl` and Android. Either gate `clone` with `all(target_os = "linux", target_env = "gnu")`, or state in the module docs that other libcs were not audited. The Step 3 claim that the stack is "lazily committed" is a glibc and kernel performance fact with no role in safety. Keep it out of the SAFETY comment, as the plan already does.

**R6. Small gaps in E1 and E3.**
- E1 should add: "`SIGCHLD` (17) lies within the CSIGNAL mask `0xff`, so `FLAGS | SIGCHLD` sets no further flag bit."
- E3 should add: "Locks held by *this* thread further up the stack, such as a std `Mutex`, a `OnceLock` init or the stdout lock, are copied as held. std documents that relocking them can deadlock or panic. That is not undefined behavior, and none is held on `launch`'s path."

**R7. Step 5 depends on boundary facts it does not cite.**
- `close_extra_fds` says "no live value in the child owns an fd above 2". That is true only because of E2: values in the parent's frames above `callback` were copied but are never resumed or dropped in the child. Cite E2 there.
- The parent is safe only because `FLAGS` excludes `CLONE_FILES`. The plan says this; label it I2.
- `nix::unistd::close<Fd: IntoRawFd>` accepts a bare `RawFd`, so I/O safety rests on that stated invariant. That is acceptable.
- `PR_SET_PDEATHSIG` fires when the *creating thread* exits (prctl(2)). With I1 that thread is the main thread, so cite I1. The remaining pre-`prctl` window is not a soundness issue. If it ever matters, it can be closed safely: the child checks a pipe for `POLLHUP` after `prctl`.

**R8. Enforcement of "one `unsafe`".** Step 6's grep checks which files contain `unsafe`, not how many blocks. Add `clippy::undocumented_unsafe_blocks` and `clippy::multiple_unsafe_ops_per_block` as `deny` in `clone.rs`, and assert `grep -c 'unsafe {' src/clone.rs` equals 1. The earlier review's UR-10 (`forbid` versus `deny`) still applies and remains acceptable for a course project.

## Corrected wording (suggested, not applied)

Step 0 `Cargo.toml`: add `rust-version = "1.81"` under `[package]`.

Module docs, with I5 added and I3 made honest:

```rust
//! I1 (one thread): `spawn` calls `clone` only after `only_thread()` has seen exactly one
//!    entry in a procfs `/proc/self/task`, and runs no code between the two that can create
//!    a thread (moves of locals and, inside `only_thread`, one `ReadDir` drop; see I5).
//! I2 (flags): every clone uses `FLAGS`; callers cannot choose flags.
//! I3 (stack): every clone uses a fresh heap `Vec` of `STACK` = 8 MiB bytes, alive in the
//!    parent until `clone` returns. It has no guard page, by the one-`unsafe` constraint;
//!    see A1.
//! I4 (callback): the only closure cloned is built here, from `&Run`, and calls
//!    `supervise::container_main`. No safe caller can change what the child runs.
//! I5 (allocator): this crate declares no `#[global_allocator]`; allocation is glibc malloc,
//!    which never creates threads.
//! A1 (ASSUMPTION, not proved; design.md "Constraint for the plan"): the child's stack use
//!    stays below `STACK`. Evidence only: see E5 in `spawn`.
```

`spawn` doc and body:

```rust
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
    // Operation: `nix::sched::clone(child, &mut stack, FLAGS, Some(SIGCHLD))`, nix =0.31.3
    // (audited src/sched.rs: calls libc `clone(callback, (end of stack) - (end % 16),
    // FLAGS | SIGCHLD, &mut child)` with no ptid/tls/ctid; `callback` is a Rust
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
    //  E1 (I2, LOCAL FACT) FLAGS is NEWPID|NEWNS|NEWUTS|NEWIPC: none of the C4 flags, and
    //     not CLONE_VM, CLONE_FILES or CLONE_FS. SIGCHLD (17) lies within the CSIGNAL byte
    //     0xff, so OR-ing it adds no flag. => C4.
    //  E2 (DEPENDENCY LEMMA, clone(2), glibc 2.36) without CLONE_VM the child runs in a
    //     separate copy of this address space at the same addresses, so `child`, `&Run`
    //     and nix's frame exist unchanged there. "When fn returns, the child process
    //     terminates", so the child never resumes a frame above `callback` and never frees
    //     them. Writes in either process are invisible to the other, so the parent's drop
    //     of `child` (once, when nix's `clone` returns) and of `stack` do not affect the
    //     child. => C5.
    //  E3 (I1, safety-usable invariant of `only_thread`; I5) the process had exactly one
    //     thread when `only_thread` read procfs. A thread is created only by a thread of
    //     this process (clone(2)), and since then this thread has only dropped a `ReadDir`
    //     (glibc `free`, I5) and moved locals, so it still has one. C2's antecedent is
    //     false, and the child may allocate, lock, format and print. Locks this thread
    //     holds further up the stack are copied as held; relocking them can deadlock or
    //     panic (std docs), not cause UB.
    //  E4 (I3, LOCAL FACT) `stack.len() == STACK == 8 MiB >= 16`. => C3.
    //  E5 (ASSUMPTION A1; evidence, NOT proof) the child runs only `container_main`, crate
    //     code with no recursion (I4), plus std's `Command::spawn`, fs and formatting, which
    //     std runs routinely on its documented 2 MiB thread stacks; 8 MiB is 4x that.
    //     [Measured high-water mark: N KiB, Step 6.] There is no guard page, so an overflow
    //     is not guaranteed to fault. No safe caller can raise the child's stack depth.
    //     C1 is NOT discharged; it rests on A1, accepted in design.md.
    //  E6 (AXIOM, Reference, rustc >= 1.81 per Cargo.toml `rust-version`: a panic that
    //     would unwind out of a Rust-defined `extern "C"` function aborts) nix's
    //     `callback` is such a function. => C6.
    // Postconditions:
    //  Ok(pid): the child is PID 1 of new namespaces, running `child` on its copy of
    //   `stack`; the caller must reap `pid`. Here, `child` has been dropped once and
    //   `stack` is freed when it goes out of scope.
    //  Err(e): no child exists (clone(2) returned -1), and `child` was dropped once, here.
    let pid = unsafe { nix::sched::clone(child, &mut stack, FLAGS, Some(Signal::SIGCHLD as c_int)) };
    pid.map_err(Error::Clone)
}

/// # Safety-usable invariant
///
/// Returns `Ok(())` only if `/proc/self/task` is on procfs and lists exactly one
/// thread at the time of the read. Any other outcome, including I/O errors, is `Err`.
fn only_thread() -> Result<(), Error> { /* statfs PROC_SUPER_MAGIC check, then count */ }
```

design.md, "Constraint for the plan", add: "The child's stack is a heap buffer with no guard page, because a guard page would need four more `unsafe` calls. Its proof therefore rests on one named assumption: the child's stack use stays below 8 MiB. That figure is evidence (a margin over std's 2 MiB thread default, plus a measured high-water mark), not proof. No caller input affects it. Toolchain: rustc ≥ 1.81."

## Earlier findings (2026-10-07-unsafe-rust-review.md), checked after this verdict

| Earlier | Status in the revision |
|---|---|
| UR-1 flags as a parameter | **Discharged.** FLAGS is a const, and `spawn(run: &Run)` takes no flags. |
| UR-2 single thread unchecked | **Discharged** by `only_thread` and I1, apart from the allocator premise (R2) and procfs (R4), which the earlier review also missed. |
| UR-3 stack overflow | **Partly.** 8 MiB, a crate-controlled closure, and honest "evidence, not proof" wording. The guard page was declined by the user. Its suggested fallback, a measured high-water mark, is not in the plan. Residual: R3. |
| UR-4 caller-provided closure | **Discharged.** The closure is built in `clone.rs` (I4). |
| UR-5 missing obligations and postconditions | **Discharged.** C1 to C6 and the postconditions are present; refinements in R5 and R6. |
| UR-6 version not pinned | **Discharged** (`=0.31.3`). New, related gap: the *toolchain* is not pinned (R1). |
| UR-7 fd closing | **Discharged.** The invariant is stated in Step 5; cite E2 and I2 (R7). |
| UR-8 raw exit, no flush | **Discharged.** Step 3 notes it. |
| UR-9 panic status in PID 1 | **Discharged.** Step 6 forces a panic and records the status. |
| UR-10 deny vs forbid | Not addressed. Still acceptable (R8). |
| UR-11 CLONE_NEWPID | Not applicable. |
