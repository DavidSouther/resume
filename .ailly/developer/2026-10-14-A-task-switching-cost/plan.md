# Implementation Plan: ctxswitch


Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: none are loadable (see `research.md`, Libraries & Skills). Step 6 applies `research/unsafe-rust-review-SKILL.md` through a cold auditor.

**Feature test:** `pages/course/cisc_7310/ctxswitch/tests/run.sh`, run on a host with Docker.
**User story:** The course author runs one command and gets five ported programs and a five mechanism switching cost benchmark, all run in resource limited `debian:stable-slim` containers, with an evidence packet that supports (and does not contain) their answers.
**As built (deviations):** stacks are `mmap` guarded only (`Stack::heap` was removed after the unsafe audit); `Context::spawn`/`bind` take no link, and `unsafe spawn_linked` carries `uc_link`; the getcontext double return runs in `global_asm` (`run_twice`) and `capture_raw` was deleted; `Fiber::new` returns `Result`; `green` has `spawn`/`yield_now`/`run` and `JoinHandle::take` (no parking `join`); `scripts-dev.sh` runs cargo in a Linux container; `UNSAFE.md` and `REVIEW.md` live in the crate. Open decision from design: the x86_64 build is checked for correctness under emulation only.
**Constraint:** `unsafe` exists only in `src/uctx.rs`, `src/regswitch.rs` and the stack allocation in `src/green.rs`; every unsafe item carries a proof style contract or comment.

**Steps:**
- [x] Step 0: API surface area
- [x] Step 1: Crate, Dockerfile, and the ucontext module with the four `umcontext` programs
- [x] Step 2: `umthreaddemo`, the cooperative scheduler
- [x] Step 3: Register only switch and green thread runtime
- [x] Step 4: `switchbench` mechanisms, working sets and CSV
- [x] Step 5: Kernel view observers (`strace`, `/proc`)
- [x] Step 6: Unsafe audit, REVIEW.md, and the production run

Patterns applied (`patterns:using-patterns`): **newtype** for `WorkingSet` and `Mechanism`, **parse-dont-validate** for the `switchbench` command line, **errors-typed-untyped** with one `thiserror` enum for the library and `anyhow` free `main`s, **arrange-act-assert** for unit tests. The context lifetime is a **type-state** candidate (`Fresh` after `getcontext`, `Ready` after `makecontext`) and is left as a plain pinned box: the programs are a fixed call sequence.

## Step 0: API surface area

Edition 2021, `rust-version = "1.92"` (host toolchain; the Docker build stage uses the same minor version). Dependencies: `libc`, `nix` (features `sched`, `resource`, `process`, `signal`), `thiserror`.

```rust
// src/uctx.rs : the only module touching ucontext_t
pub struct Context { /* Pin<Box<UnsafeCell<libc::ucontext_t>>> */ }
pub struct Stack { /* Box<[u8]>, owned, never moved while a Context points at it */ }
impl Context {
    pub fn zeroed() -> Self;
    pub fn capture(&self) -> Result<(), Error>;                       // getcontext
    pub fn bind(&self, stack: &mut Stack, link: Option<&Context>, entry: extern "C" fn()) -> Result<(), Error>; // makecontext, argc = 0
    pub fn resume(&self) -> Error;                                     // setcontext, only returns on failure
    pub fn swap(&self, from: &Context) -> Result<(), Error>;           // swapcontext(from, self)
}
pub mod regs { pub fn dump(c: &Context, out: &mut impl Write) -> io::Result<()> } // printctx
// src/regswitch.rs : only module with inline assembly
pub struct Fiber { /* saved sp + stack */ }
impl Fiber { pub fn new(stack: Stack, entry: extern "C" fn()) -> Self; pub fn switch(from: &mut Saved, to: &mut Saved); }
// src/green.rs : Runtime { spawn, yield_now, join }, Stack::guarded (mmap + guard page)
// src/bench/{mod,thread,process,ucontext,regswitch,green,workingset,rusage}.rs
pub struct WorkingSet(usize);                       // touch(): one byte per 64 byte line
pub enum Mechanism { Thread, Process, Ucontext, Regswitch, Green }
pub struct Row { mechanism: String, working_set_bytes: usize, switches_per_rep: u64, reps: u32, ns_per_switch: f64, nvcsw: u64, nivcsw: u64 }
pub fn run(m: Mechanism, ws: WorkingSet, switches: u64, reps: u32) -> Result<Row, Error>;
// binaries: src/bin/{uctxswitch,uctxmake,uctxswap,uctxrestore,umthreaddemo,switchbench}.rs
```

## Step 1: Crate, Dockerfile, and the ucontext module with the four `umcontext` programs

**Enables:** the first four checks under "umcontext and umthread ports" and the limits check.

Create the crate, a multi stage `Dockerfile` (build stage on a `rust` Debian image with `cargo build --release`; run stage `debian:stable-slim` with `strace` installed and the binaries on `PATH`), and `src/uctx.rs` with the ported `getcontext`/`setcontext`/`makecontext`/`swapcontext` wrappers. Port `printctx` for `x86_64` (the C register list) and `aarch64`. Port `uctxswitch`, `uctxmake`, `uctxswap`, `uctxrestore` with identical output strings.

Critical notes: `getcontext` returns twice, which Rust does not model. The port keeps the second return observable only through a `static AtomicBool` read after `#[inline(never)]` calls, and documents the residual risk. A `ucontext_t` on `x86_64` points into itself (`fpregs`), so it is heap pinned and never moved after `getcontext`. Stacks outlive every context that points at them.

**Tests**

```rust
test "uctxswap call order matches the C original":
  output <- run_bin("uctxswap")
  assert lines starting with "func" or "main:" equal the C original's seven lines
```

- `uctxswap` with an argument sets no `uc_link` and the process ends inside `func2`.
- `uctxmake` returns from `hello_user` with `uc_link` null and the process exits 0.
- Zeroed `Context` is never swapped into (type prevents it: `swap` requires a captured context).

**Implementation Outline**

```rust
fn capture(&self) { unsafe { getcontext(self.ptr()) } }
fn bind(...) { ss_sp = stack.as_mut_ptr(); ss_size = stack.len(); uc_link = link.ptr_or_null(); makecontext(self.ptr(), entry, 0) }
```

## Step 2: `umthreaddemo`, the cooperative scheduler

**Enables:** the `umthreaddemo` checks (20 user lines, 10 world lines, both exit messages, exit 0).

Port the dispatch loop. Contexts and exit flags are process globals in C; in Rust they are a `static` holder (`OnceLock` of a struct with `Context`s and `AtomicBool`s), because entry functions are `extern "C" fn()` with no arguments. The scheduler `swap`s into each thread; each thread `swap`s back, 50 ms `usleep` equivalent via `std::thread::sleep` is acceptable since it is one OS thread.

**Tests**: run twice and compare the interleaving to the C original's sequence (user, world, user, world, ... then user alone after world exits).

- The final "exiting" swap never resumes the exited thread.
- Stack size `1 << 14` is enough for `println!`; if not, record the measured need and raise it with a comment.

**Implementation Outline**

```rust
loop { report exits; if both exited break; if !hu_exited { hu.swap(&main) } if !hw_exited { hw.swap(&main) } }
```

## Step 3: Register only switch and green thread runtime

**Enables:** `regswitch` and `green` rows in the benchmark.

`global_asm!` for `x86_64` (save `rbx rbp r12 r13 r14 r15` and `rsp`, load the other side, `ret`) and `aarch64` (save `x19 to x30`, `sp`, `d8 to d15`). A new `Fiber` has its stack prepared so the first switch "returns" into the entry function with a 16 byte aligned stack. Any other target fails to compile with a clear message.

Then a `green` module in the style of Dzania's "Green Threads from Scratch" and `rsroutine` (credited in a module comment and in `README`; independent implementation, since no license is declared): `Stack::guarded` (`mmap`, `PROT_NONE` guard page, `mprotect` for the usable part, `munmap` on drop), a `Runtime` with a FIFO run queue, `spawn`, `yield_now`, and `join`, single worker thread. The stack is 32 KiB as in the article, so the contrast with a 2 MiB kernel thread stack is visible in `REVIEW.md`.

**Tests**: green: two tasks each yielding 1000 times alternate strictly and `join` returns their results; a write below the stack bottom faults on the guard page (checked in a child process). Register switch: ping pong 1000 switches between main and a fiber incrementing a counter; assert 1000 and that callee saved registers survive (a test function that sets known values in registers via inline asm clobbers and checks).

- Entry returning must not fall off the stack: entry ends in a switch back that never returns, or aborts.
- Alignment: 16 bytes at call boundaries on both architectures.

**Implementation Outline**

```asm
switch(from, to): push callee saved; mov [from], sp; mov sp, [to]; pop callee saved; ret
```

## Step 4: `switchbench` mechanisms, working sets and CSV

**Enables:** the `bench.csv` shape, kernel counters and ordering assertions.

Implement the five mechanisms and two baselines. `thread` and `process` pin to CPU 0 (`nix::sched::sched_setaffinity`), hand a one byte token over `UnixStream::pair`. `ucontext` and `regswitch` hand control between two contexts in one thread. Every handoff touches the working set first. Time with `Instant`, five reps, median ns per switch; accumulate `getrusage` voluntary and involuntary deltas (`RUSAGE_SELF`, plus `RUSAGE_CHILDREN` for `process`). Command line: `--mechanisms`, `--switches`, `--reps`, `--working-sets`.

**Tests**: `--mechanisms regswitch --switches 1000 --reps 1 --working-sets 0` prints a header and one row whose `nvcsw` is below 1000.

- `process` child exits cleanly even when parent errors.
- A switch count of 0 is rejected at parse time.
- Output always has the header, even if a mechanism fails (the failure goes to stderr and exit status).

**Implementation Outline**

```rust
for ws in sets { for m in mechanisms { rows.push(median_of(reps, || timed_run(m, ws, n))) } }
```

## Step 5: Kernel view observers

**Enables:** the `strace` and `proc` sections of the feature test.

`--strace-friendly` disables the warmup sleep so `strace -c -f` sees only the loop. `--proc-snapshot` re-executes `switchbench` as an observer child (`--observe <pid>`) that sleeps briefly, then prints `== /proc/<pid>/task/<tid>/<file> ==` blocks for `stat`, `status`, `syscall`, `wchan`, `stack` (missing or denied files are printed as a one line note, never as an error).

**Tests**: observer output on a sleeping child contains one `status` block with the expected pid.

- Reading `stack` without privilege returns EACCES or EPERM; recorded as a note.
- The observer is a process, so it never appears as a task of the benchmark.

## Step 6: Unsafe audit, REVIEW.md, and the production run

**Enables:** `REVIEW.md` checks and the final green run.

Dispatch a cold auditor (strongest available model: the work is strict, rule heavy and far harder to produce than to check) with `research/unsafe-rust-review-SKILL.md` and the two unsafe modules. It writes `reviews/unsafe-audit.md` (copied to the crate as `UNSAFE.md`, which the feature test requires, with zero open rejections) with every unsafe site, the proof obligations, the premises that discharge them, and rejections. Fix all rejections and re-run. Run `tests/run.sh` with the release image; copy the passing results to `results/final/`. Write `REVIEW.md` from those results: per question, "Evidence", "Where to look", and a `**For you to answer:**` line left blank. Optionally run `cargo miri test` on the `uctx` unit tests if Miri supports them (it will not support `getcontext`; record that as a finding rather than skipping silently).

**Tests**: the feature test itself.

- Ordering contradiction is evidence, not a bug to hide.
- If `strace` is blocked by the Docker seccomp profile, record it and fall back to `perf trace`-free reasoning in `REVIEW.md`, flagged.
