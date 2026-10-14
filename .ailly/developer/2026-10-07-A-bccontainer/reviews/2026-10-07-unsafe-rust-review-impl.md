# Unsafe Rust review: the implemented clone boundary

*Rubric: Google rust-skills `unsafe_rust_review/SKILL.md`, used only as a review rubric. Reviewer: isolated, post-implementation. The verdict below was formed before reading the two plan-stage reviews; they were read afterwards only to check that their findings are discharged. No project file was edited. All experiments ran in a scratch copy of the crate under the session scratchpad.*

*Inputs: `src/clone.rs` (module `# Invariants` I1 to I5 and A1, `CLONE_FLAGS`, `spawn`, the `// SAFETY:` block C1 to C6 / E1 to E6 / postconditions, `only_thread`), `src/supervise.rs`, `src/sandbox.rs`, `src/launch.rs`, `src/stack.rs`, `src/cli.rs`, `src/main.rs`, `src/container.rs`, `src/status.rs`, `Cargo.toml`, `tests/stack.sh`; nix 0.31.3 `src/sched.rs` (`CloneCb`, `clone`) and `src/unistd.rs` (`fork`'s `# Safety`, `close`); clone(2). Toolchain observed: rustc 1.97.0, host glibc 2.39 (Ubuntu), kernel 6.18, x86_64.*

## Verdict

**No undefined-behaviour path was found, and no High-severity defect.** The implementation matches the re-reviewed plan almost line for line. Every input that reaches the `unsafe` call is fixed inside `clone.rs`. The flags are a private const, the closure is built in the module, and the stack comes from a `StackSize` that cannot be below 1 MiB.

**The SAFETY block discharges C2, C3, C4, C5 and C6 as implemented. It does not discharge C1**, and says so: C1 rests on the labelled assumption A1. This is the only remaining High-class gap under the rubric. It is accepted in design.md, and its evidence was reproduced here by two independent methods (below), so it is not a new defect. Strictly, then, the block does **not** discharge every obligation. It discharges every obligation except C1, and it states C1's status honestly. Under the rubric that makes the boundary acceptable as a documented trade-off, not proved sound.

Three Medium findings and ten Low findings remain. They are wording and premise gaps, plus one configuration gap. None of them changes the conclusion.

- **M1.** E3 borrows `fork`'s contract, but a raw `clone` is not `fork`. The difference (no child-side fix-up by glibc, a stale TCB TID) is not stated. The earlier review asked for this lemma (UR-9) and the code did not carry it.
- **M2.** "glibc only" is documented but not enforced. `cfg(target_os = "linux")` still compiles the unaudited musl path.
- **M3.** The glibc the proof depends on is the host's run-time glibc, not a build-time or container one. The text names 2.36 (bookworm), while the measurement, the tests and this review ran on 2.39.

## Contract re-derived from nix 0.31.3

The source is `nix-0.31.3/src/sched.rs:107-137`. `clone(mut cb: CloneCb, stack: &mut [u8], flags, signal)` computes `ptr = stack.as_mut_ptr().add(stack.len())`, then `ptr_aligned = ptr.sub(ptr as usize % 16)`. It then calls `libc::clone(transmute(callback), ptr_aligned, flags.bits() | signal.unwrap_or(0), &mut cb as *mut _ as *mut c_void)` and passes no `ptid`, `tls` or `ctid`. `callback` is a Rust `extern "C" fn(*mut CloneCb) -> c_int` that does `&mut *data` and then `(*cb)() as c_int`. `cb` is dropped when nix's frame returns, which happens in the parent only.

The `# Safety` text requires that the child not overflow `stack`, and it points to `fork`. `fork`'s `# Safety` (`unistd.rs:266-276`) says: "In a multithreaded program, only async-signal-safe functions ... may be called by the child ... until a call of `execve(2)`."

That gives exactly C1 to C6 of the implemented comment. One premise is used but not cited: nix's doc sentence "`stack` is a reference to an array which will hold the stack of the new process". This is what licenses using memory lent as `&mut [u8]` as a machine stack, which the Reference does not model (L5). nix's own `fn`-pointer transmute (`*mut Box<dyn FnMut>` to `*mut c_void` parameter) is internal to the pinned dependency, and both are thin raw pointers. Trusting it is a dependency choice, and the `=0.31.3` pin makes that choice explicit.

## Obligations as implemented

| # | Obligation | Evidence in code | Check against the code as written | Status |
|---|---|---|---|---|
| C1 | No stack overflow | E5 / A1 | Labelled ASSUMPTION. Reproduced: 16 KiB debug, 12 KiB release by pagemap; ≈9.9 KiB / ≈5.0 KiB high-water by an independent pattern fill (below). No guard page. | **Not discharged; rests on A1** (accepted) |
| C2 | Multithreaded ⇒ async-signal-safe only | E3, I1, I5, `only_thread` | `Box::new` and `vec!` run *before* `only_thread()` (clone.rs:103-105). Between the read and the call, only the `ReadDir` drop inside `count()`, a `match`, `?` and moves run. Confirmed: a scratch build that starts a thread before `launch` gets `bcdocker: clone: the process has more than one thread`, exit 1, and no clone. | **Discharged**, with the unstated raw-clone lemma (M1) |
| C3 | `stack.len() >= 16` | E4 | `StackSize` has a private field. Its only constructors are `parse` (range-checked `MIN..=MAX`) and `Default` (8 MiB), so `bytes() >= 1 MiB` is a TYPE FACT. | **Discharged** |
| C4 | No SETTLS / *_SETTID / CHILD_CLEARTID / PIDFD | E1, I2 | `CLONE_FLAGS` is a private const, equal to the four namespaces (unit test). SIGCHLD = 17 < 0x100. | **Discharged** |
| C5 | `child`, `&Run`, nix's `cb` live in the child; drop ≤ once per address space | E2 | `Run` lives in `main::run`'s frame. The child has a private copy and never returns above `callback`, because glibc's clone.S issues `SYS_exit` after `fn` returns. The parent drops `cb` once in nix's frame, on both `Ok` and `Err`. On the early return (`only_thread()?`), `child` and `stack` are dropped in `spawn` and no clone happens. The parent's free of `stack` (munmap of the calloc'd mapping) does not touch the child's copy. | **Discharged** (wording gaps L3, L4) |
| C6 | A panic must not unwind through libc | E6 | `rust-version = "1.96"` ≥ 1.81. Verified: forced panic → "panic in a function that cannot unwind" at `nix::...::callback` → abort. | **Discharged** (outcome wording L1) |

Postconditions (clone.rs:164-168) match the source on both arms. The early-return path before the call needs no postcondition.

## Experiments (scratch copy only)

All of these used `target/test-work/containers/bctest` and a copy of the crate under the scratchpad.

1. **A1 measurement, project binaries.** `tests/stack.sh`, debug: 16 KiB at 8 MiB, at 1 MiB, and at 1 MiB with 2000 args and a 100 KB env, `ok`. With `BCDOCKER=target/release/bcdocker`: 12 KiB in all three, `ok`. The figures in E5(b) and design.md are reproduced exactly.
2. **A1, independent method.** The scratch copy filled the stack with `0xAA` and scanned for the deepest overwritten byte just before `container_main` returned. Debug: 10128 bytes on the success path, on the 2000-argument path, and on the failing-exec path with a 3000-byte path name. Release: 5168 bytes on all three. So the pagemap figure is a conservative upper bound: page-rounded, plus one page. This method also covers the error path, which `stack.sh` only runs and does not measure. Without a guard page, "did not crash" there is not evidence; this measurement is.
3. **Thread refusal.** The scratch build spawned a parked thread before `launch` and got `Err(Threads)`, exit 1. Under libtest, `only_thread()` returns `Err` even alone with `--test-threads=1`, so the positive case is covered only by end-to-end runs.
4. **Panic in PID 1.** The host saw exit **139** (SIGSEGV), not 134. `strace` shows `tgkill(1, 1, SIGABRT)` twice, each ignored, because namespace init has no handler. glibc's `abort` then executes `hlt`, and the kernel forces SIGSEGV. Under ptrace the forced signal does not clear `SIGNAL_UNKILLABLE`, so the child spins on SIGSEGV forever; the traced run had to be killed. The `tgkill(1, 1, …)` arguments also show that glibc 2.39 `raise` uses the kernel TID, not the stale TCB TID (see M1).
5. **IDs in the child.** `getpid() = gettid() = std::process::id() = 1`. Inside the app, `NSpid: 3` and `Threads: 1`.
6. **Descriptors.** The child's descriptors at entry are 0-2, any inherited host fds, and the `read_dir` fd. No std, nix or glibc global holds one. With host fds 3, 7 and 9 open, `ls -l /proc/self/fd` in the container shows only 0-2 plus `ls`'s own directory fd.
7. **Huge stack.** `--stack-size 1G` works normally. Under `ulimit -v 600M` it prints `memory allocation of 1073741824 bytes failed` and SIGABRT, exit 134, in the *parent*, before `only_thread` and before any clone. That is sound but rough (L6).
8. `cargo build`, `cargo build --release`, `cargo test` (27 passed) and `cargo clippy --all-targets` are clean. The plan's acceptance grep lists only `src/clone.rs` and `src/main.rs`, and `grep -c 'unsafe {' src/clone.rs` prints `1`.

## Findings

### High

None new. The standing High-class item is **C1/A1**: an obligation the proof does not discharge, with no guard page. It is labelled, accepted in design.md, CI-checkable with `tests/stack.sh`, and the margin was reproduced: about 100x over the true debug high-water mark at the 1 MiB floor. The assignment requires `clone()`, so the fork-plus-`unshare` alternative from the re-review (R3) is not recommended.

### Medium

**M1. E3 relies on `fork`'s contract, but this is a raw `clone`, and the difference is not stated.** (clone.rs:113-114, 134-141)
Evidence: C2 is cited "via `fork`", and E3 concludes that "C2's antecedent is false, and the child may allocate, lock, format and print". `fork(3)` in glibc does child-side fix-ups that the glibc `clone()` wrapper does not do: atfork handlers, re-initialising malloc, stdio and loader locks, and writing the new TID into the thread control block. In the child here, `THREAD_SELF->tid` still holds the host TID of the parent thread, while the kernel TID is 1. The single-thread argument (I1) covers the lock part, because no other thread can hold a glibc-internal lock. The stale TID is a separate premise. It is harmless only because nothing reached in the child relies on it:
- Rust std's `Mutex`, `RwLock` and `ReentrantLock` use futexes and a TLS `ThreadId`, not pthread TIDs.
- glibc ≥ 2.34 `raise` and `abort` call `gettid` (observed `tgkill(1, 1, SIGABRT)`).
- `Command::spawn` goes through glibc `fork` or `posix_spawn`, which set up their own child.

The earlier review asked for this to be recorded (UR-9: "Record this as a platform lemma"). The implementation did not.
Fix: append to E3:
```text
//     Unlike fork(3), glibc's clone() runs no atfork handlers and leaves this thread's
//     TCB TID unchanged in the child (DEPENDENCY LEMMA, glibc >= 2.34). With one thread
//     no glibc-internal lock can be held, and nothing the child reaches reads the cached
//     TID: std's locks use futexes and a TLS ThreadId, raise/abort use gettid, and
//     Command::spawn goes through glibc fork/posix_spawn, which set up their own child.
```

**M2. The gnu-only audit is documented but not enforced (rubric: configuration matrix).** (clone.rs:6-7; main.rs:11-19)
Evidence: the module says "musl and Android were not audited", but `mod clone` is gated only on `target_os = "linux"`, so `x86_64-unknown-linux-musl` compiles the same `unsafe` with none of E3's glibc lemmas: the malloc in I5, `raise` using `gettid`, and the clone wrapper's exit path. The rubric requires every in-scope cfg combination to be sound. A combination that compiles is in scope. The re-review (R5) allowed "gate or state". Stating it leaves a supported build that has no proof.
Fix (main.rs):
```rust
#[cfg(all(target_os = "linux", not(target_env = "gnu")))]
compile_error!("bcdocker's clone audit (src/clone.rs) covers glibc only");
```
Optionally, also gate on the measured architecture, or list the measured architectures in A1. E5 already says to "run `tests/stack.sh` on each target".

**M3. The glibc version in the proof is the wrong one, and it disagrees with the evidence.** (clone.rs:6, 127, 151; plan.md:476)
Evidence: the module and E2 cite "glibc 2.36 on Debian bookworm". E5(b) was measured on "glibc 2.39". This review's host also runs 2.39. bcdocker is linked dynamically and runs on the host, never inside the bookworm rootfs, so the glibc whose behaviour E2, E3 and I5 rely on is the host's run-time glibc. Building in `rust:1-bookworm` "to match bookworm-slim" fixes neither. The premise is therefore unverifiable as stated.
Fix: state the actual premise as "glibc ≥ 2.34 at run time (source audited against 2.36; measured on 2.39)". In E2, write `glibc >= 2.34` instead of `glibc 2.36`, and keep both versions in E5(b).

### Low

**L1. E6's outcome should say what "aborts" looks like in PID 1.** (clone.rs:161-163)
A panic does abort, which is all C6 needs. The host sees **139 (SIGSEGV)**, because namespace init ignores its own SIGABRT and glibc falls back to `hlt`. Under a debugger or strace the child loops forever. plan.md records 139, but the code does not. Add to E6: "In PID 1, SIGABRT is ignored (pid_namespaces(7)); glibc's abort then traps, so the host sees 139. Under ptrace the trap repeats forever."

**L2. `close_extra_fds`'s I/O-safety argument omits process-global owners and its own calling precondition.** (supervise.rs:86-99)
`nix::unistd::close<Fd: IntoRawFd>` accepts a bare `RawFd`, so I/O safety rests entirely on this comment. The comment covers the frames above `callback` (E2), the `ReadDir`, and the parent (`CLONE_FILES` excluded). It does not say that no *static* in this crate, std, nix or glibc owns a descriptor above 2 on this path, which is true: experiment 6 found none. It also does not say that the function is sound only in the cloned child. Called in the parent, the same code would close any live `OwnedFd`. The rubric's rule 7 applies to private helpers too, but `deny(unsafe_code)` forbids marking it `unsafe`. So document the precondition and keep the function private.
Fix: add "No static in this crate, std, nix or glibc owns a descriptor on this path. Call only from PID 1 after `clone` (supervise's path); in the host process it would close descriptors owned by live values."

**L3. E2's "separate copy at the same addresses" has unstated exceptions.** (clone.rs:127-133)
Shared mappings (`MAP_SHARED`) stay shared, and `MADV_DONTFORK` / `MADV_WIPEONFORK` ranges are missing or zeroed in the child. None of these hold `child`, `Run` or nix's frame: they are glibc heap and main-stack private mappings, and neither this crate, std nor glibc sets those advice flags. Add: "(all are in private anonymous mappings with no MADV_DONTFORK/WIPEONFORK, so the copy is complete)".

**L4. C5 names the wrong object.** (clone.rs:119-121)
nix passes `&mut cb as *mut _`, the address of nix's local `cb`, which is the moved `child` Box. The text says "nix's frame holding `&mut child`". Correct it to "nix's local `cb` (the moved `child`), whose address is clone's `arg`".

**L5. The use of `stack` as a machine stack is not grounded.** (clone.rs:106-110)
The child writes frames into memory that is, in Rust terms, the target of a live `&mut [u8]` argument to nix's suspended `clone` frame. The Reference does not model this. The licence is nix's documented contract ("`stack` ... will hold the stack of the new process"). Cite it as a DEPENDENCY LEMMA in E4 or E5, so that the aliasing question has a named premise.

**L6. A huge accepted stack aborts on allocation failure.** (clone.rs:104; stack.rs:11-13)
`vec![0u8; n]` with n ≤ 1 GiB calls `handle_alloc_error` and aborts when allocation fails (experiment 7: exit 134, before any clone). This is sound, since there is no UB and no child, but the process aborts instead of returning an error. The stack.rs comment "reserved, not committed" relies on glibc serving the calloc with a fresh `mmap`. Fix: `let mut stack = Vec::new(); stack.try_reserve_exact(n).map_err(|_| Error::Stack)?; stack.resize(n, 0);` with a new `Error::Stack` variant. That code is safe and changes no SAFETY premise: `stack.len() == n` still holds for E4.

**L7. `only_thread` infers "had one thread" from "listed one", and its error text is wrong for two of its three refusals.** (clone.rs:134-135, 178-187)
proc(5) does not document a readdir of `/proc/self/task` as an atomic snapshot. The inference is sound in practice, because the reader always lists itself and a missed entry would need another thread to exist. Still, it is an unstated kernel lemma behind the "safety-usable invariant". `/proc/self/status` `Threads:` reports `signal->nr_threads` as one value and would make the premise a single read. Either name the lemma or switch the source. Separately, "not procfs" and "unreadable" both map to `Error::Threads`, whose text says "has more than one thread". That is not a safety issue, but the message is misleading. Consider a `ProcUnavailable` variant.

**L8. The "one `unsafe`" enforcement is `deny`, not `forbid`, and the check is manual and narrow.** (main.rs:1, 18-19; plan.md:489)
Any module can add `#![allow(unsafe_code)]` and compile. The acceptance grep (`'allow(unsafe_code)\|unsafe {'`) misses `unsafe{`, `unsafe fn`, `unsafe impl` and `#[unsafe(...)]`, and it is not run by any script in `tests/`. This was acceptable at plan stage (UR-10, R8) and still is. A cheap hardening is a test script line such as `! grep -rnE '\bunsafe\b|allow\(unsafe_code' src --exclude=clone.rs | grep -v '^src/main.rs:.*#\[allow(unsafe_code)\]'`. The structural fix is a workspace `-sys` crate with `#![forbid(unsafe_code)]` in the binary.

**L9. Versions in E5(b) differ from the declared minimum toolchain.**
E5 was measured with rustc 1.97, while `rust-version` is 1.96. Frame sizes can change between compiler versions. The 100x margin makes this immaterial, but E5 should say "re-run `tests/stack.sh` after toolchain upgrades", or CI should run it.

**L10. The thread-refusal unit test also passes without its helper thread.** (clone.rs:224-236)
libtest always has more than one thread, even with `--test-threads=1` (experiment 3), so the test cannot tell its helper thread from the harness's. It still guards against `only_thread` wrongly returning `Ok`, which is its job. Its comment could say that the positive case is covered only by end-to-end runs.

## Specific questions from the brief

- **Does `only_thread` run immediately before `clone` with no thread-creating code between?** Yes. clone.rs:105 then 169. In between: the `?`, and inside `only_thread` after the count, the `ReadDir` drop (closedir/free). I1's text is accurate.
- **Allocation order vs I1?** Both allocations happen before the check (lines 103-104), as R2 asked.
- **The closure's borrow of `run` in the child?** It is valid. `run` points into `main::run`'s frame, which the child holds as a private copy and never unwinds (E2). `Run` has no `UnsafeCell`.
- **`stack` in the child; the parent's drop?** The child runs on its copy. The `Vec` lives in the copied `spawn` frame, which the child never resumes, so it is never freed there. The parent frees its own copy (munmap) after `clone` returns, which has no effect on the child.
- **`Box<dyn FnMut>` drops?** The parent drops it exactly once, inside nix's frame, on both `Ok` and `Err`. The child never drops it: a leak until `SYS_exit`. Sound.
- **Early returns?** `only_thread()?` drops `child` and `stack` with no clone. A `vec!` failure aborts before the check (L6). Nothing else can return early.
- **CLONE_NEWPID?** `getpid`, `gettid` and `process::id` all return 1. Nothing caches the pid. The TCB TID is stale (M1) and unused. `getppid()` is 0, as supervise.rs:46-49 notes.
- **A panic in the child?** It aborts at nix's `callback` (E6 confirmed), and the host sees 139 (L1).
- **Huge stack?** Accepted sizes keep C3 and A1. A failed allocation aborts the parent before cloning (L6).
- **Closing fds 3 and up in PID 1?** No std-owned descriptor exists. The `ReadDir` is dropped before the loop, and its number gives `EBADF`. No pidfd exists, because neither `CLONE_PIDFD` nor std's `create_pidfd` is used. Nothing opens a descriptor between the listing and the closes, so the `ReadDir`'s number cannot be reused. The proof gaps are in L2.
- **Can a module bypass `deny(unsafe_code)`?** Yes (L8).

## Earlier findings, checked after this verdict

| Earlier | Status in the code |
|---|---|
| UR-1 flags as a parameter | **Discharged.** `CLONE_FLAGS` is a private const; `spawn(run: &Run)`. |
| UR-2 / R2 single thread, allocator | **Discharged.** `only_thread` and I1. I5 is present, and the allocations come before the check. |
| UR-3 / R3 stack overflow | **Accepted as A1**, with a measured high-water mark. Both measurements reproduced. The wording is honest: "C1 is NOT discharged". |
| UR-4 caller closure | **Discharged** (I4). |
| UR-5 obligations and postconditions | **Discharged.** |
| UR-6 nix pin | **Discharged** (`=0.31.3`, with a comment in Cargo.toml). |
| UR-7 / R7 fd closing | **Discharged.** E2 and I2 are cited, and `EBADF` is expected. Residual gap: L2. |
| UR-8 raw exit | Not stated in the code. Harmless: the child writes only to unbuffered stderr. |
| UR-9 panic status, TID lemma | Panic status: recorded in plan.md as 139, not in the code (L1). The **TID/atfork lemma was not carried into E3: regressed to unstated (M1).** |
| UR-10 / R8 deny vs forbid | The clippy denies were added. The grep check is manual (L8). |
| R1 toolchain pin | **Discharged** (`rust-version = "1.96"`). |
| R4 procfs check, helper doc | **Discharged.** `statfs` `PROC_SUPER_MAGIC`, plus `# Safety-usable invariant`. Residual: L7. |
| R5 config matrix and citation | Citation fixed (clone(2) quoted in E2). Config matrix only *stated*, not gated (M2). Version premise inconsistent (M3). |
| R6 E1 SIGCHLD, E3 locks | **Discharged.** |

New since the plan, with no earlier finding: `--stack-size` and `StackSize`. Checked: the type keeps C3 and A1 for every accepted value. The only new edge is L6.
