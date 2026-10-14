# Unsafe Rust review: the clone boundary (plan.md, design.md, spikes)

*Rubric: Google rust-skills `unsafe_rust_review/SKILL.md`, used only as a review rubric. Reviewer: isolated, pre-implementation. Nothing else was edited.*

*Inputs: plan.md (Step 0 `clone::spawn` signature, Step 3 `clone.rs` sketch and its SAFETY comment, the Step 3 closure that borrows `run`, Step 5), design.md "Constraint for the plan", `research/spike/nix/src/main.rs` (`mod sys`), `research/spike/own/src/main.rs` (`mod sys`, for comparison only), and the nix 0.31.3 source at `~/.cargo/registry/src/*/nix-0.31.3/src/sched.rs` (`clone`, `CloneCb`) and `src/unistd.rs` (`fork`'s `# Safety`, `close`).*

## Verdict

The planned `unsafe { nix::sched::clone(...) }` can be made sound. As planned, though, it is not. The SAFETY comment in the plan and the one in the spike each fail the rubric. The main defect is structural: `clone::spawn` is a safe `pub fn`, but its soundness depends on facts the caller controls, namely the `flags` argument, what the closure does, and how many threads the process has. Under the rubric's rule 7 ("Do not impose hidden safety obligations on safe callers", which also covers private helpers), the wrapper is unsound as specified. "`unsafe` appears only in the clone module" is true of the syntax. The proof obligations, however, leak into `launch`, `supervise`, `sandbox`, `main`, and the test harness. Three changes fix this: fixed flags inside the module, a dynamic single-thread check, and a stack with a guard page. With those, the wrapper can stay safe and the design constraint holds.

## The contract being discharged

`nix::sched::clone` (nix 0.31.3) has this `# Safety` section, quoted from the source:

> Because `clone` creates a child process with its stack located in `stack` without specifying the size of the stack, special care must be taken to ensure that the child process does not overflow the provided stack space. See `fork` for additional safety concerns related to executing child processes.

`nix::unistd::fork`'s `# Safety` says:

> In a multithreaded program, only async-signal-safe functions like `pause` and `_exit` may be called by the child (the parent isn't restricted) until a call of `execve(2)`. Note that memory allocation may **not** be async-signal-safe and thus must be prevented.

Reading the source shows further obligations that the docs do not state. The function computes `stack.as_mut_ptr().add(stack.len())`, then `ptr.sub(ptr as usize % 16)`, then calls `libc::clone(callback, ptr_aligned, flags | signal, &mut cb as *mut _)`. It passes no `ptid`, `tls`, or `ctid` variadic arguments. `callback` is a Rust `extern "C" fn` that does `&mut *data` and calls `(*cb)()`. The `cb` Box lives in nix's stack frame in the parent and is dropped there when `clone` returns.

### Obligations (O) and premise sources

| # | Obligation | Source class | Planned evidence | Status |
|---|---|---|---|---|
| O1 | The child must not overflow `stack`. | PRECONDITION (nix `# Safety`) | "uses far less than 1 MiB" | **Not discharged.** Unmeasured, and the closure is arbitrary caller code. There is no guard page. |
| O2 | If the process is multithreaded, the child may call only async-signal-safe functions until `execve`. | PRECONDITION (nix, by reference to `fork`) | "single-threaded caller" | **Not discharged.** The premise is misnamed, undocumented, and unchecked (UR-2). The child allocates, formats, prints, mounts, and calls `Command::spawn`. |
| O3 | `stack.len() >= 16`, so that `add(len).sub(ptr % 16)` stays inside the allocation. With an empty slice the subtraction leaves the allocation. | DEPENDENCY LEMMA from nix's *source*. Undocumented. | none | Holds by LOCAL FACT (`1 << 20`), but the proof does not state it. |
| O4 | `flags` must not ask the kernel to read or write through arguments nix never passes: `CLONE_SETTLS`, `CLONE_PARENT_SETTID`, `CLONE_CHILD_SETTID`, `CLONE_CHILD_CLEARTID`, `CLONE_PIDFD`. Otherwise the kernel uses garbage register values as addresses. | PLATFORM LEMMA (clone(2)) plus nix source | none | **Not discharged.** `flags` is a parameter of a safe fn. |
| O5 | `flags` must not contain `CLONE_VM`. With it, the parent returns, drops `cb`, frees the `Vec` stack, and ends the `'_` borrow of `Run` while the child is still running on that memory. That is use-after-free. | PLATFORM LEMMA (clone(2)) plus TYPE FACT (`CloneCb<'a>`) | "no CLONE_VM" | **Asserted, not established.** Stated as a fact, but `flags` comes from the caller. |
| O6 | The closure Box, everything it borrows (`&Run`), and nix's frame holding `&mut cb` stay allocated in the child for the child's whole life. Nothing frees them there. | PLATFORM LEMMA (separate copy of the address space at the same addresses, given O5) plus LOCAL FACT (glibc's clone trampoline exits after `callback` returns, so the child never unwinds into `nix::clone`, `spawn`, or `launch`) | spike: "child never returns into this frame" | Half stated. The spike gives the right fact but not the conclusion. |
| O7 | Drop accounting: each address space drops `cb` at most once. | LOCAL FACT (nix source): the parent drops `cb` once when `clone` returns. The child never drops it, a leak that ends at process exit. | none | Holds, but the proof does not state it. A leak is acceptable under the rubric. |
| O8 | A panic in the closure must not unwind through the glibc frame. | AXIOM (Reference: a panic that would unwind out of a Rust-defined function with a non-`-unwind` ABI aborts) | none | Holds, because nix's `callback` is a Rust `extern "C" fn`. The proof should cite it. |
| O9 | The stack pointer handed to the kernel is aligned for the target ABI. | DEPENDENCY LEMMA (nix docs: "Nix will take care of that requirement") plus source (`% 16`) | none | Holds. Cite it. |
| O10 | The stack memory is not used through a Rust reference while it serves as the child's machine stack. | LOCAL FACT: after the call, the child never resumes a frame that holds the `&mut [u8]`. The parent's copy is untouched by the child. | spike: "Stack is owned for the call" | **Wrong temporal scope.** The child uses its copy of the stack *after* the call returns in the parent. The relevant fact is that the address space is copied, not that the stack is owned for the duration of the call. |

## Findings

### High

**UR-1. `clone::spawn` is a safe fn whose soundness depends on its arguments (rubric rule 7, reject pattern 2).**
Evidence: plan.md Step 0 declares `pub fn spawn(child: nix::sched::CloneCb<'_>, flags: CloneFlags) -> Result<Pid, Errno>`. Its Step 3 SAFETY comment says "no CLONE_VM", but `flags` is a parameter. Safe code in `launch.rs`, or any later caller, can pass `CLONE_VM` (O5: use-after-free of `stack`, `cb`, and `Run`), or `CLONE_SETTLS`, `CLONE_*_SETTID`, `CLONE_CHILD_CLEARTID`, or `CLONE_PIDFD` (O4: kernel writes through garbage addresses). It can also pass `CLONE_FILES`, after which Step 5's close-every-fd-above-2 closes the parent's live `OwnedFd`s, an I/O-safety violation in the parent. The spike's `sys::spawn(cb, flags)` has the same shape, and so does the own spike's `sys::clone(f, flags: c_int)`. The comment cites a local fact that is not true at the program point. Module privacy does not help; the rubric explicitly rejects that defense.
Fix: remove `flags` from the signature and use a module constant `FLAGS = NEWPID | NEWNS | NEWUTS | NEWIPC`. Alternatively, keep the parameter and return `Err(EINVAL)` unless `flags.difference(ALLOWED).is_empty()`, with `ALLOWED` a namespace-only allowlist.

**UR-2. The single-thread premise is misnamed, undocumented, and unenforced, and it carries O2.**
Evidence: plan.md says "single-threaded caller". The research note (rust-safe.md section 4) says the same. The child's code is `report(supervise(run))`, followed in Steps 4 and 5 by `sandbox::enter` (`PathBuf::join` allocates), `read_dir("/proc/self/fd")`, `Command::spawn`, thiserror `Display`, and `eprintln!`. Every one of these allocates or takes locks, so the call is sound only if the antecedent of nix's `fork` clause is false. The property needed is not "the caller is single-threaded". It is "**the process has exactly one thread at the instant of `clone`**". No invariant states this and nothing checks it. `cargo test` runs tests on several threads, so any future test that reaches `launch` violates the premise silently. A later `std::thread::spawn` anywhere, or a dependency that starts a thread, would do the same. The premise also matters to Step 5: `PR_SET_PDEATHSIG` fires when the parent *thread* exits, not the parent process.
Fix: inside `clone.rs`, immediately before the call, count the entries of `/proc/self/task` (safe std) and refuse unless there is exactly one. The check cannot go stale before `clone`. When the count is 1, the only thread that could create another is the current one, and the code between the check and the call creates none. Document this as module invariant I1 and cite it in the SAFETY comment. An unreadable `/proc` means refuse.

**UR-3. Stack overflow is undefined behavior here, not a fault. The 1 MiB size is folklore.**
Evidence: plan.md: "The child only runs supervise and sandbox code, which uses far less than 1 MiB." No measurement or bound is given. The claim is also non-local: `spawn` accepts any `CloneCb`, so the closure is caller-provided code that may recurse without bound. `vec![0u8; 1 << 20]` goes through `calloc`, which glibc serves with `mmap` at this size. Nothing guarantees an unmapped or `PROT_NONE` page below it, so an overflow can silently write into whatever mapping lies below. The rubric excludes Rust's own overflow detection as an axiom, and it does not apply here anyway: std installs guard pages only for the main thread and for threads it spawns. The feature test runs a debug build (`cargo build`), where frames are larger. research/rust-safe.md recommended 8 MiB, and the plan chose 1 MiB without saying why. This is the one obligation nix's `# Safety` names explicitly, and neither SAFETY comment addresses it: the spike's says nothing about size at all.
Fix: allocate the stack in `clone.rs` as an 8 MiB anonymous mapping with a `PROT_NONE` page below it (`nix::sys::mman::mmap_anonymous` plus `mprotect`, both `unsafe` and both allowed in this module, each with its own SAFETY comment). The pages are committed lazily, so the size costs nothing until used. With a guard page, an overflow becomes SIGSEGV in the child. That last step rests on rustc's per-target stack probes, a compiler fact rather than a Reference guarantee, so label it as such. A minimum alternative: make the closure crate-controlled (UR-4) and record a measured high-water mark. That is evidence, not proof, as the rubric's reject pattern 3 says.

### Medium

**UR-4. The closure is caller-provided code for proof purposes.**
Evidence: `launch.rs` builds `Box::new(|| report(supervise(run)))`, and `clone.rs` is generic over any `CloneCb<'_>`. The SAFETY comment's "the child only runs supervise and sandbox code" describes code `clone.rs` cannot see. The rubric requires a proof that can be checked locally. If UR-1, UR-2, and UR-3 are fixed as proposed, arbitrary safe closures become sound: the child is then a single-threaded copy of the process with a guarded stack, so the closure's behavior no longer matters to the proof. Otherwise, narrow the API to `spawn_container(run: &Run)` and build the closure inside `clone.rs`, so every reachable callback is crate-controlled (rubric section 3, case 3).

**UR-5. The SAFETY comments omit most obligations and all postconditions.**
Neither comment names the operation's contract or classifies its premises. Neither covers O3, O4, O6, O7, O8, or O9. Neither states postconditions. The rubric requires postconditions here because the call transfers ownership of the stack and the closure into a second address space. Missing items: in the parent, `cb` is dropped once and the stack is freed after return; in the child, both live until exit and are never dropped; the exit status is `callback`'s `isize` cast to `c_int` and then truncated to 8 bits by the kernel. The spike's "Stack is owned for the call" has the wrong temporal scope (O10). Reject patterns that apply:
- "Caller guarantees it" (pattern 2): "single-threaded caller" and "only runs supervise and sandbox code" both rely on callers.
- "Pointer is valid" style (pattern 1): "Stack is owned".
- A premise that is neither proof nor measurement (pattern 3 and the folklore rule): "far less than 1 MiB".

**UR-6. The proof relies on behavior of nix's source that its docs do not state, but the version is not pinned.**
Evidence: the plan declares `nix 0.31` (caret). O3, O4, O7, and the "child never drops `cb`" fact come from the 0.31.3 source, not its docs. nix's `# Safety` says nothing about `CLONE_VM`, the missing variadic arguments, or ownership of `cb`. The rubric says: "Do not silently rely on a dependency's undocumented behavior" and "Prefer pinned versions."
Fix: pin `nix = "=0.31.3"`, or name the audited version in the SAFETY comment and re-audit `sched.rs` whenever the version changes.

**UR-7. Step 5 closes descriptors by number, which interacts with the boundary.**
Evidence: Step 5: "lists `/proc/self/fd`, collects the numbers, then closes every descriptor above 2", using `nix::unistd::close(fd)`. That function is safe and generic over `IntoRawFd`, which `RawFd` implements, so this is not memory UB in this crate. It can still break std's I/O-safety contract (std `io` module, "I/O Safety") if a live Rust object in the child owns one of those numbers. The `ReadDir` that produces the listing owns one of them. The plan's order (collect, then close) is correct only if the `ReadDir` is dropped first. The step is also safe for the *parent* only because of the no-`CLONE_FILES` fact from UR-1.
Fix: state the invariant ("at the close point, no live value in the child owns an fd above 2; the `ReadDir` is dropped before the loop") next to `close_extra_fds`, and treat `EBADF` from the `ReadDir`'s old number as expected.

### Low

**UR-8. The child ends through glibc's raw `exit` syscall, not `std::process::exit`.** After `callback` returns, glibc's clone trampoline calls `SYS_exit`. No atexit handlers run and Rust's line-buffered stdout is not flushed. This is not a soundness issue: `report` uses stderr, which is unbuffered. Do not use `print!` without a newline in the child.

**UR-9. A panic in PID 1 may not produce SIGABRT.** O8 makes a panic in the child abort. But PID 1 of a PID namespace ignores default-action signals sent from inside its own namespace, its own `raise(SIGABRT)` included. glibc's `abort` then falls back to an illegal-instruction trap, which the kernel forces. The host would then see 132 or 139, not 134. This is defined behavior, but surprising; check it once by hand. Relatedly, glibc's `clone` does not run atfork handlers and leaves the parent's TID in the child's thread control block. With one thread (I1), and given that Rust's `Mutex` and `ReentrantLock` use futexes and thread-local identities rather than pthread TIDs, no undefined behavior was found. Record this as a platform lemma for glibc 2.36 (bookworm).

**UR-10. Enforcing the constraint.** `#![deny(unsafe_code)]` with `#[allow(unsafe_code)] mod clone` lets any module add its own `allow`. Only Step 6's grep catches that. Acceptable for a course project. A workspace split (a `-sys` crate, and `#![forbid(unsafe_code)]` in the binary) would make the constraint mechanical. If `spawn` ever becomes an `unsafe fn` (Variant B below), add `#![deny(unsafe_op_in_unsafe_fn)]`, since edition 2021 allows unsafe operations in `unsafe fn` bodies by default.

**UR-11. `CLONE_NEWPID` effects on the proof: none.** The child is PID 1, `getppid()` returns 0 (which is why Step 5's window cannot be closed), and once PID 1 exits, later forks into the namespace fail with `ENOMEM`. None of this changes O1 to O10. The kernel itself rejects `CLONE_NEWPID | CLONE_THREAD` and `CLONE_NEWNS | CLONE_FS` with `EINVAL`.

### Comparison: the own spike (rejected alternative)

It has seven `unsafe` sites against one. Its `Box::into_raw` / `Box::from_raw` handoff of a `FnOnce` gives clearer ownership: the child consumes the closure and the parent leaks it once per spawn. Its stack math (`& !15` on the top) is correct. It has the same flags-as-parameter defect as UR-1. Its comments ("valid C string", "pointer and length describe `name`") are closer to adequate for those simple FFI calls, but they still name no contract. The review supports the user's choice of nix: nix replaces six of the seven sites with audited safe wrappers.

## Proposed text (suggested, not applied)

### Variant A (recommended): a safe wrapper that discharges everything locally

```rust
//! The only module allowed to use `unsafe`.
//!
//! # Invariants
//!
//! I1 (one thread): `spawn` calls `clone` only after `only_thread()` has seen exactly
//!    one entry in `/proc/self/task`, and runs no code between the two that creates a thread.
//! I2 (flags): every clone uses `FLAGS`; callers cannot choose flags.
//! I3 (stack): every clone uses a `GuardedStack` of `STACK` bytes, directly above a
//!    `PROT_NONE` page, that stays mapped in the parent until `clone` returns.

const FLAGS: CloneFlags = CloneFlags::CLONE_NEWPID
    .union(CloneFlags::CLONE_NEWNS)
    .union(CloneFlags::CLONE_NEWUTS)
    .union(CloneFlags::CLONE_NEWIPC);
const STACK: usize = 8 << 20;

/// Runs `child` as PID 1 of new PID, mount, UTS and IPC namespaces and returns its host PID.
///
/// Safe to call: callers cannot choose clone flags or the stack, and the call fails
/// (without cloning) unless the calling thread is the only thread in the process.
/// The child runs in a copy of this process's memory. `child`, and everything it
/// borrows, stays valid there until the child exits and is never dropped there.
/// In this process `child` is dropped exactly once, before `spawn` returns.
/// The child's exit status is `child()`'s return value, truncated to 8 bits.
pub fn spawn(child: CloneCb<'_>) -> Result<Pid, Error> {
    only_thread()?;
    let mut stack = GuardedStack::new(STACK)?;
    // SAFETY:
    // Operation: `nix::sched::clone(child, stack.usable(), FLAGS, Some(SIGCHLD))`,
    // nix =0.31.3 (audited src/sched.rs: calls glibc `clone(callback,
    // (end of stack) & !15, FLAGS | SIGCHLD, &mut child)` with no ptid/tls/ctid
    // arguments; `callback` is a Rust `extern "C" fn` calling `(*child)()`).
    // Required contract:
    //  C1 (nix # Safety) the child must not overflow `stack`.
    //  C2 (nix # Safety via `fork`) in a multithreaded process the child may call
    //     only async-signal-safe functions until execve.
    //  C3 (nix source) `stack.len() >= 16`, so its alignment arithmetic stays in bounds.
    //  C4 (clone(2) + nix source) FLAGS must exclude CLONE_SETTLS, CLONE_PARENT_SETTID,
    //     CLONE_CHILD_SETTID, CLONE_CHILD_CLEARTID and CLONE_PIDFD, whose arguments nix does not pass.
    //  C5 (CloneCb<'_> vs clone(2)) `child`, the data it borrows, and nix's frame holding
    //     `&mut child` must stay allocated in the child while it runs, and `child` must be
    //     dropped at most once per address space.
    //  C6 a panic in `child` must not unwind through the glibc frame.
    // Evidence:
    //  E1 (I2, LOCAL FACT) FLAGS is NEWPID|NEWNS|NEWUTS|NEWIPC. It contains none of the
    //     C4 flags, and not CLONE_VM, CLONE_FILES or CLONE_FS. => C4.
    //  E2 (PLATFORM LEMMA, clone(2)) without CLONE_VM the child runs in a separate copy
    //     of this address space at the same addresses. So `child`, its borrows (e.g. `&Run`),
    //     and nix's frame exist unchanged in the child. glibc's clone trampoline exits after
    //     `callback` returns, so the child never resumes a frame above `callback` and never
    //     frees them. Writes in either process are invisible to the other, so the parent's
    //     drop of `child` (once, when nix's `clone` returns) and of `stack` do not affect
    //     the child. => C5.
    //  E3 (I1, POSTCONDITION of `only_thread`) the process has exactly one thread now:
    //     only a running thread can create a thread, and `GuardedStack::new` creates none.
    //     So C2's antecedent is false, and the child may allocate, lock, format and print.
    //  E4 (I3, LOCAL FACT) `stack.usable().len() == STACK == 8 MiB >= 16`. => C3.
    //  E5 (I3, POSTCONDITION of `GuardedStack::new`; PLATFORM LEMMA, not a Reference
    //     guarantee) the page directly below the usable range is PROT_NONE here, and so in
    //     the child's copy. rustc's stack probes on x86_64/aarch64 Linux touch every page
    //     of a large frame, so an overflow faults (SIGSEGV kills the child) before it
    //     writes below the guard page. => C1, as "overflow cannot corrupt memory".
    //  E6 (AXIOM, Reference: a panic that would unwind out of a Rust-defined `extern "C"`
    //     function aborts) nix's `callback` is such a function. => C6.
    // Postconditions:
    //  Ok(pid): the child is PID 1 of new namespaces, running `child` on its copy of
    //   `stack`. Here, `child` has been dropped once and `stack` is unmapped when it
    //   goes out of scope.
    //  Err(e): no child exists, and `child` was dropped once, here.
    let pid = unsafe { nix::sched::clone(child, stack.usable(), FLAGS, Some(Signal::SIGCHLD as c_int)) };
    pid.map_err(Error::Clone)
}
```

`only_thread()` is safe code: `std::fs::read_dir("/proc/self/task")?.count() == 1`, or `Err(Error::Threads)`. `GuardedStack::new`, its `Drop`, and `usable()` each hold one more `unsafe` call (`mmap_anonymous`, `mprotect`, `munmap`, and a slice built from the mapping). Each needs its own SAFETY comment in the same form: the length is `STACK + page`, the mapping is private and anonymous, the slice covers exactly the bytes above the guard page, and it is unmapped once, in `Drop`. `launch.rs` keeps `clone::spawn(Box::new(|| report(supervise(run))))` with no `unsafe`.

### Variant B (only if `flags` and the closure stay caller-chosen): an `unsafe fn` contract

This forces `unsafe` into `launch.rs`, which breaks the design constraint. For that reason Variant A is preferred.

```rust
/// Runs `child` in a new process created by `clone(2)` with `flags | SIGCHLD`.
///
/// # Safety
///
/// The caller must ensure that:
///
/// 1. `flags` contains none of `CLONE_VM`, `CLONE_FILES`, `CLONE_SETTLS`,
///    `CLONE_PARENT_SETTID`, `CLONE_CHILD_SETTID`, `CLONE_CHILD_CLEARTID`, `CLONE_PIDFD`.
/// 2. At the instant of the call the calling thread is the only thread in the process,
///    or else `child` calls only async-signal-safe functions (no allocation, no locks,
///    no `std` I/O) until it calls `execve` or exits.
/// 3. `child`, and everything it calls, uses less stack than `STACK` minus nix's
///    `callback` frame, on every path, including panics and error formatting.
///    (Unverifiable in practice; the reason for Variant A's guard page.)
///
/// These obligations hold from the call until the child exits or execs.
///
/// If they hold, this function returns the child's PID. The child runs `child` in a
/// copy of the caller's memory in which `child` and its borrows stay valid and are
/// never dropped. In the caller, `child` is dropped exactly once before return.
/// The child's exit status is `child()`'s return value, truncated to 8 bits.
pub unsafe fn spawn(child: CloneCb<'_>, flags: CloneFlags) -> Result<Pid, Errno>
```

The call site in `launch.rs` would then need its own `// SAFETY:` proving 1 to 3 at that point.

## Summary for the plan

1. Step 0: change the signature to `spawn(child: CloneCb<'_>) -> Result<Pid, clone::Error>`. Add `clone::Error { Threads, Clone(Errno), Stack(Errno) }`, and map `Clone(EPERM)` to the `--privileged` hint as before.
2. Step 3: replace the sketch's SAFETY comment with Variant A. Add the thread check and the guarded 8 MiB stack. Pin nix to `=0.31.3`.
3. Step 3 tests: run the binary by hand, as planned. Do not call `spawn` from `cargo test`; I1's check would refuse anyway, and that refusal is the correct behavior.
4. Step 5: document the fd-ownership invariant at `close_extra_fds` (UR-7).
