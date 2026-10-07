# Unsafe Rust re-review of the implementation: `clone.rs` and its dependents

Rubric: Google rust-skills `unsafe_rust_review` (proof-obligation method). It was used only as a rubric.
Scope: `src/clone.rs` as it stands, plus `stack.rs`, `supervise.rs`, `sandbox.rs`, `launch.rs`, `main.rs`, `cli.rs`,
and `Cargo.toml` (nix =0.31.3, rust-version 1.96). Host for the measurements: x86_64, glibc 2.39 (Ubuntu
2.39-0ubuntu8.9), rustc 1.97.0. I ran as root. I formed this verdict without reading earlier reviews.

## Verdict

**The SAFETY block does not yet discharge every obligation as implemented.**

- C2 through C6 are discharged. The evidence for each holds against the code and against nix 0.31.3's source.
- C1 may rest on assumption A1, as the user decided. But A1's stated basis is false for some accepted input.
  E5(a) says the stack depth does not depend on the input, and the `spawn` doc says the same. On the path that
  std takes when the application name has no `/`, glibc reserves stack space in proportion to the argument
  count. That space is reserved on the clone-provided heap stack. I reproduced an overflow of that stack from the
  command line at an accepted `--stack-size` (finding 1).
- Separately, the new `allocate()` probe moves stacks of 32 MiB or less (this includes the 1 MiB floor and the
  8 MiB default) into the brk heap, directly above live allocations. The overflow above did not fault, so the
  failure mode is silent corruption (finding 2).

The fix needs no new `unsafe`: cap the argument count so the argument-dependent term is bounded, and say so in
A1 and E5(a). With finding 1 fixed and its wording corrected, I would accept the block: C1 would rest on A1
honestly, and C2 through C6 are proved.

## Re-derived contract (nix 0.31.3 `src/sched.rs:107-135`, clone(2))

- `# Safety`: the child must not overflow `stack` (C1). The fork(2) concerns also apply: in a multithreaded
  program the child may call only async-signal-safe functions (C2).
- Source facts:
  - `ptr = stack.as_mut_ptr().add(len)`, then `ptr.sub(ptr % 16)`. This needs `len >= 15` (C3).
  - nix passes no ptid, tls or ctid (C4).
  - `arg = &mut cb`, where `cb` is the moved `Box<dyn FnMut>` local in nix's frame (C5).
  - `callback` is a Rust-defined `extern "C" fn` (C6).
  - The flag word is `flags.bits() | signal`.
- glibc x86_64 `clone.S`: after `fn(arg)` returns, the child issues the raw `exit` syscall with the return value.
  So no atexit handlers and no TLS destructors run, and no frame above `callback` is ever resumed.

## Findings, ranked by severity

### 1. HIGH: A1's basis is falsified; an overflow is reachable from CLI input at `--stack-size 1M`

Where:
- `clone.rs:161-162`, E5(a): "the stack depth does not depend on the input".
- `clone.rs:101-102`, the `spawn` doc: "`run`'s sizes do not affect the child's stack depth".
- The cause is `supervise.rs:53-57`, where `.env("PATH", …)` is combined with an application name that has no `/`.

Mechanism (traced with strace and measured):
- With `.env("PATH")` set and a program name that has no `/`, std does not use `posix_spawn`. It uses
  `fork()`. The strace shows `clone(child_stack=NULL, flags=CLONE_CHILD_CLEARTID|CLONE_CHILD_SETTID|SIGCHLD)`
  for `run bctest true`, and `clone3(CLONE_VM|CLONE_VFORK…, stack_size=0x9000)` for `run bctest /bin/true`.
- The forked grandchild keeps running on PID 1's stack pointer, which is inside its copy of the heap `Vec`.
- In the grandchild, glibc `execvp` → `__execvpe`. If `execve` returns `ENOEXEC`, `maybe_script_execute` declares
  `char *new_argv[argc > 1 ? 2 + argc : 3]`. This is a variable-length array on the stack, sized by argc.

Reproduction:
- Setup: an overlay of `bctest` in a scratch directory. It added `/usr/local/bin/noexec`, mode 0755, containing
  `echo hi` with no shebang.
- Command: `bcdocker run --stack-size 1M <ovl> noexec` followed by N empty arguments.

| N | stack | exit status |
| --- | --- | --- |
| 1000, 100000, 131000, 131200 | 1M | 0 (prints `hi`) |
| 131400, 131600, … 200000 | 1M | 139 (SIGSEGV in the application process) |
| 200000 | 8M | 0 |
| 200000 with `/usr/local/bin/noexec` (has a `/`, so std uses `posix_spawn`) | 1M | 1 (`Exec format error`) |

Analysis:
- At N = 131200 the array alone is `(131201 + 2) * 8` = 1,049,624 bytes. That is larger than the whole 1,048,576-byte
  `Vec`, and the run started below the top of it. So the grandchild wrote past the start of the stack
  allocation, and nothing faulted. Finding 2 explains why: the memory there is mapped heap.
- The kernel's argv limit with `ulimit -s 8192` is 2 MiB of strings plus pointers. That allows about 230k empty
  arguments, which is enough to overflow the 1 MiB floor. Only `ulimit -s unlimited` (6 MiB) gets close to the
  default 8 MiB.
- This happens in the grandchild, a fork of PID 1, before `execve`. It is still out-of-bounds writing on the stack
  that `clone` was given. The test `tests/stack.sh` does not cover it: it uses `/bin/sh`, which takes the
  `posix_spawn` path, and it measures only PID 1.

Fix, with no new `unsafe`:
- (a) Bound the argument count in `cli::parse`, for example `MAX_ARGS = 16384`. The array is then at most 128 KiB,
  a fixed fraction of MIN. Add the bound to A1/E5(a).
- (b) Optionally, resolve the application against `DEBIAN_PATH` inside the chroot before calling `Command::new`.
  An absolute path keeps std on `posix_spawn`, which gives the grandchild its own stack sized for argv. That is
  std implementation behaviour, not documented, so (a) is the fix the proof should rest on.
- (c) Add a fork-path case to `tests/stack.sh`: a name without `/`, a non-ELF target, and many arguments at 1M.

Corrected wording:
- E5(a): "the child runs only `container_main`: crate code with no recursion and no large locals (I4). Paths,
  the environment and error text live on the heap, and nix's path buffers are fixed at 1024 bytes. One
  input-dependent term remains: when std forks to run the application (a name without `/` with PATH set), glibc's
  `execvpe` script fallback puts `(argc + 3) * 8` bytes on this same stack in the forked process. `cli::parse`
  caps argc at MAX_ARGS, which bounds that term at …".
- `spawn` doc: replace "`run`'s sizes do not affect the child's stack depth" with "`run`'s sizes affect the
  child's stack depth only through the argument count, which `cli::parse` bounds (E5(a))".

### 2. MEDIUM: `allocate()`'s probe moves the default and floor stacks into the brk heap above live chunks

Where: `stack.rs:62-70`, and the I3 and E5 sentence "There is no guard page, so an overflow is not guaranteed to
fault" (`clone.rs:175-176`).

Evidence:
- `try_reserve_exact(n)` mallocs n bytes; above 128 KiB that is an mmap. The probe then frees it. glibc's free of
  an mmapped chunk raises `M_MMAP_THRESHOLD` to that chunk's size when the size is 32 MiB or less (the dynamic
  threshold). The following `vec![0; n]` (calloc of n) then falls below the new threshold and is carved from the
  brk heap.
- In `/proc/<pid1>/maps` the child's stack pointer is in `[heap]` for 1M and 8M (1027 KiB and 8195 KiB into
  `[heap]`), and in a separate anonymous mapping for 32M and 64M.
- A scratch program that copies `allocate()` showed the same pattern. Without the probe, a `Box` allocated just
  before is far below the `Vec`, which is in its own mmap. With the probe, the `Box` sits 0x40 bytes below the
  `Vec` in `[heap]`. In `spawn`, the closure `Box` (line 112) is allocated immediately before `allocate()`
  (line 113).
- So an overflow off the bottom runs straight into the closure, `Run` and other live chunks. Finding 1's N = 131200
  run went past the `Vec` without faulting.

This does not change the discharge, because C1 rests on A1 either way. It does make the failure mode silent
corruption rather than a likely SIGSEGV. The doc's "`vec!` then gets the same space" is false.

Fix:
- Keep the probe alive until after `vec!`: `let mut probe = Vec::new(); probe.try_reserve_exact(n)?; let stack = vec![0u8; n]; drop(probe);`.
  The threshold rises only after the stack is in its own mmap. This briefly costs 2n of address space, so the
  allocator refuses some sizes it could have held. That is conservative.
- Or drop the probe and accept `handle_alloc_error`'s abort, which is not UB.

Corrected wording:
- `stack.rs` doc: "or `Alloc` if a reservation of that size fails. The check and the allocation are separate, so
  a later `vec!` failure still aborts."
- E5 last sentence: "There is no guard page, and with glibc a stack of 32 MiB or less lies in the brk heap
  directly above live allocations, so an overflow is expected to corrupt them silently rather than fault."

### 3. LOW: E3 premises are worded imprecisely (`clone.rs:143-155`, I1 at `clone.rs:10-12`)

- "since then this thread has only dropped a `ReadDir`": after the observation, `count()` also runs the
  remaining `getdents64` calls and frees the entries before `closedir`. None of that creates a thread, so the
  conclusion stands. Write it as "finished iterating `/proc/self/task` and dropped the `ReadDir` (getdents64,
  `free`, `closedir`; I5)". Also say that the only asynchronous code that can run here is std's SIGSEGV/SIGBUS
  handlers, which create no threads.
- "With one thread no glibc-internal lock can be held": the correct reason is that the only thread is not
  executing inside glibc when `clone` is called. `spawn` is reached by a direct call from `main`, not from a signal
  handler or a glibc callback. Thread count alone does not exclude a lock held by the same thread.
- The atfork and cached-TID paragraph is correct for glibc 2.34 and later, which includes the 2.36 and 2.39
  premise:
  - `raise` uses `gettid`. My panic-as-PID-1 harness printed `thread 'main' (1)`, the kernel TID.
  - std's locks are futex- and ThreadId-based.
  - PID 1's `fork()` uses `CLONE_CHILD_SETTID`, so the grandchild's TID is refreshed. The strace confirms this.

### 4. LOW: the panic postcondition is missing; the status is 139, not 134 (`clone.rs:106-107`, `181-185`)

The `spawn` doc says the exit status is `container_main`'s return value truncated to 8 bits. That holds only for a
normal return.

Measured with nix 0.31.3 and the same glibc, cloning with `CLONE_NEWPID`:
- A panic in the closure prints "panic in a function that cannot unwind" and aborts. This confirms E6.
- PID 1 ignores its own `SIGABRT` because the action is SIG_DFL and the task is SIGNAL_UNKILLABLE. glibc `abort`
  then falls through to its abort instruction. std's SIGSEGV handler returns to SIG_DFL, and the forced SIGSEGV
  kills the process. The host sees `Signaled(SIGSEGV)`, and `Status` maps that to 139.
- Without `CLONE_NEWPID`, the same harness gives SIGABRT.

Add this postcondition: "a panic in the child aborts; as PID 1 the abort is delivered as SIGSEGV, status 139."
Unwinding inside the child before the abort only drops the child's copies, so C5's "dropped at most once per
address space" still holds.

### 5. LOW: the safety-usable facts in `stack.rs` are not labelled or enforced at compile time

- E4 relies on `allocate()` returning exactly `bytes()` bytes, and on `StackSize`'s field being in `MIN..=MAX`.
  The rubric wants a `/// # Safety-usable invariant` on `allocate` and a `// Safety invariant:` on the `StackSize`
  field (`stack.rs:24-27`).
- `Default` (`stack.rs:73-77`) builds `StackSize(DEFAULT)` without a check. Add
  `const _: () = assert!(16 <= MIN && MIN <= DEFAULT && DEFAULT <= MAX);`.

### 6. LOW: the glibc premise is a build-time guard for a run-time fact (`clone.rs:6-8`, `27-28`)

- `compile_error!` on `not(target_env = "gnu")` correctly excludes musl and Android builds.
- The glibc that is actually read is the host's at run time (dynamic linking), and nothing checks its version.
  State this: "Not checked at run time. A host glibc older than 2.34, or one not audited, is outside this proof."
- E5's caveat about other architectures is correct and sufficient.

### 7. LOW: `close_extra_fds` has an unenforced precondition (`supervise.rs:85-99`)

- nix 0.31.3's `close` takes `impl IntoRawFd`, and `RawFd` qualifies, so this is safe code. Its I/O-safety
  premise is "only in the cloned PID 1, where no live value owns an fd above 2", and that premise is prose only.
- std's I/O-safety docs call a safe function that acts on fds it does not own unsound.
- Today only the clone closure reaches it. A cheap guard that needs no `unsafe` would turn the documentation into
  an enforced check: `if nix::unistd::getpid().as_raw() != 1 { return Err(...) }`. The claims about which fds the
  child owns (the ReadDir dropped before the close, no static fds in std, nix or glibc on this path) checked out.

### 8. INFO: claims that hold as written

- **I1 ordering.** The closure `Box` (`clone.rs:112`) and `allocate()` (`clone.rs:113`) both run before
  `only_thread()` (`clone.rs:114`). Between `only_thread` returning `Ok` and `clone`, the only operations are `?`
  and moves.
- **C3 / E4.** `vec!` gives `len == n`, and `n >= MIN = 1 MiB`, so `len >= 16`. The probe can fail after the check
  only by aborting, which is not UB.
- **C4 / E1.** `CLONE_FLAGS` is `NEWPID|NEWNS|NEWUTS|NEWIPC`. nix cannot name SETTLS, the SETTID flags,
  CHILD_CLEARTID or PIDFD. 17 lies within CSIGNAL (0xff). The strace shows exactly
  `CLONE_NEWNS|CLONE_NEWUTS|CLONE_NEWIPC|CLONE_NEWPID|SIGCHLD`.
- **C5 / E2.**
  - Without `CLONE_VM` the child has a private copy.
  - nix's `cb` local is dropped once in the parent when `clone` returns, on both `Ok` and `Err`.
  - The child exits through the raw `exit` syscall in `clone.S`, so no frame above `callback` is resumed and no
    atexit handler or TLS destructor runs. Add this last point to E2.
  - The parent freeing `stack` affects only its own copy.
- **C6 / E6.** nix's `callback` is a Rust `extern "C" fn`, and the abort was observed. `rust-version = "1.96"`
  makes Cargo refuse toolchains older than 1.81 unless the user overrides it.
- **E5(b) numbers.** I rebuilt and ran `tests/stack.sh`. Debug: 16/16/16 KiB. Release, three runs: 12/12/16 KiB
  (default, floor, floor with 2000 arguments and a 100 KB environment). The failing-exec and 1G-refusal checks
  passed. These match E5(b) exactly. The test still measures only PID 1 on the `posix_spawn` path (see finding 1).
- **`main.rs`.** `#![deny(unsafe_code)]` with `#[allow(unsafe_code)] mod clone;` confines the lint exemption to
  `clone.rs`. `deny` rather than `forbid` is required for that allow to work. The `clippy::*` denies take effect
  only under clippy.
- **`supervise`.**
  - pdeathsig is delivered to PID 1, because the dying parent is outside the namespace, so the kernel forces the
    signal.
  - The `waitpid(None)` loop terminates on the application's status.
  - `eprintln!` and `Command::spawn` in the child are covered by E3.
- **`sandbox.rs` and `launch.rs`** contain no unsafe-relevant assumptions beyond the namespace flags (I2).
