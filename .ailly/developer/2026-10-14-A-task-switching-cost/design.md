# Design: ctxswitch, a task switching cost experiment

Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: none are loadable. `research.md` (Libraries & Skills) explains why, and names `research/unsafe-rust-review-SKILL.md` as the document the unsafe audit applies.

## Purpose

CISC 7310X slide 15 ("Why a Thread Switch Is Cheaper") states that a thread switch is cheap because it saves registers, switches a stack pointer and reloads a TCB, with no address space switch. The next slides ask students to measure that. This feature gives the course author a runnable experiment and an evidence packet, so they can write their own answers to four questions about saved state, kernel visibility, cost, and the link to slide 15. It does not answer those questions.

## Prior Art

- "Green Threads from Scratch" and `rsroutine` by Dzania [research.md sources 6 and 7]: a user level runtime in Rust with a callee saved register switch, guarded stacks, and an M:N scheduler. Used here as the model for the `green` mechanism and its contrast with the kernel; its code is not reused because it declares no license and targets Apple Silicon macOS only.
- Upstream C examples `umcontext` and `umthread` (H. Chen), which show `getcontext`, `setcontext`, `makecontext`, `swapcontext` and a cooperative round robin scheduler.
- lmbench `lat_ctx`, the classic pipe token ping pong with working set sizes.
- Sibling projects `psstat` (a Dockerfile plus scripts that record `/proc` evidence) and `bccontainer` (a Rust crate with one audited `unsafe` call) in `pages/course/cisc_7310/`.

## User Journey and Metrics

The course author, on a machine with Docker, runs one command: `pages/course/cisc_7310/ctxswitch/tests/run.sh`.

1. A container image is built. Its runtime stage is `debian:stable-slim`.
2. Each ported program runs in a container created with explicit limits: `--cpus=1 --cpuset-cpus=0 --memory=256m --memory-swap=256m --pids-limit=64`, and the limits actually applied are read back with `docker inspect` and saved.
3. The five programs (`uctxswitch`, `uctxmake`, `uctxswap`, `uctxrestore`, `umthreaddemo`) produce the same observable output as the C originals, including register dumps on `x86_64` and `aarch64`.
4. `switchbench` runs five switching mechanisms at working sets of 0, 32 KiB and 256 KiB:
   - `thread`: two threads of one process on one CPU, handing a one byte token back and forth over a socket pair. Every handoff makes the kernel switch tasks.
   - `process`: the same, with two processes (fork), so the address space also changes.
   - `ucontext`: two glibc user contexts handing control back and forth with `swapcontext`, in one thread.
   - `regswitch`: two user contexts handing control with a hand written switch that saves only callee saved registers and the stack pointer, in one thread.

   - `green`: green threads in the style of Dzania's "Green Threads from Scratch" and `rsroutine` (attributed in `README` and `REVIEW.md`): a small runtime with a run queue, `yield_now`, and `mmap`ed stacks with a guard page, switching with the same register-only technique, all inside one worker thread. It differs from `regswitch` by the cost of a scheduler picking the next task, which is what a real green thread library pays on top of the raw switch.

   Two baselines subtract work that is not a switch: `baseline-socket` (one thread writes and reads its own socket pair, same syscalls, no task switch) and `baseline-sigprocmask` (the `rt_sigprocmask` call that glibc makes inside `swapcontext`).
5. For every mechanism the run records nanoseconds per switch (median of five repetitions) and the kernel's own count of voluntary and involuntary context switches (`getrusage`). A `strace -c -f` run per mechanism records syscalls issued. A `/proc/<pid>/task/*/{stat,status,syscall,wchan,stack}` snapshot, taken while tasks are blocked in a handoff, records which tasks the kernel lists and what it holds for them (the `syscall` file prints saved user registers of a blocked task).
6. Everything lands in `results/<UTC timestamp>/` and `REVIEW.md` links to it.

Metrics that define "working":
- Kernel mechanisms (`thread`, `process`): kernel voluntary context switches are at least half of the number of handoffs.
- User mechanisms (`ucontext`, `regswitch`, `green`): kernel context switches are under 1 percent of handoffs, and `/proc` lists one task.
- Cost ordering at working set 0: `regswitch` < `ucontext` < `thread`, and `green` < `ucontext`. If a run contradicts this, the run fails visibly and the contradiction is itself evidence for `REVIEW.md`. `process` versus `thread` is reported, not asserted: on aarch64 with address space identifiers the page table switch may not be measurable.
- `strace`: `ucontext` issues at least one `rt_sigprocmask` per switch, `regswitch` issues none in the loop.

## Specification

Port. Each C program becomes one Rust binary with matching output text. `printctx` becomes a shared function that prints the same registers as the C version on `x86_64`, and the equivalent set (`x0` to `x28`, `fp`, `lr`, `sp`, `pc`) on `aarch64`. The i386 branch is not carried over. `uctxrestore` loops forever by design (it restores to a context taken before its own `sleep(1)`); the experiment runs it under a timeout.

Unsafe. All `unsafe` lives in two small modules (ucontext FFI and the register switch). Every `unsafe` block and `unsafe fn` carries a `# Safety` contract or a safety comment written as a proof in the style of `unsafe_rust_review`, and a cold reviewer audits them. Programs and the benchmark outside those modules contain no `unsafe`.

Cost. Methodology notes, so that `REVIEW.md` can state them without guessing: the benchmark pins every task to CPU 0 inside a one CPU cpuset; it warms up before timing; the working set work is a read and write of one byte per cache line over a private buffer between switches, identical for every mechanism; absolute times include Docker Desktop VM overhead, so ratios and counters are the evidence.

REVIEW.md. For each of the four questions: a heading with the question verbatim, an "Evidence" list pointing at result files and numbers, "Where to look" pointers (kernel source paths and man pages, flagged as not yet verified by the author), and "For you to answer" left empty. It states no conclusion.

## Alternatives

- Use lmbench `lat_ctx` unmodified: does not cover `ucontext` or a register switch, and is not a port of the course examples.
- `perf` and `bpftrace` for kernel visibility: richer, but need privileged containers and kernel headers that Docker Desktop does not provide. The `getrusage` counters plus `strace` and `/proc` answer the same "what does the kernel see" question without privilege.
- Run natively on macOS: `ucontext` is deprecated there and the course target is Linux.

## Summary

Feature test: `pages/course/cisc_7310/ctxswitch/tests/run.sh`. It is red until the crate, Dockerfile and `REVIEW.md` exist.

Deferred: the M:N multi worker scheduler of [6] (more than one worker thread), a `sched_yield` kernel variant, cross CPU placement, `x86_64` timing (the `x86_64` build is checked for correctness only under emulation, not timed), preemptive user threads.

### Open Artifact Decisions

**pages/course/cisc_7310/ctxswitch/:** crate and directory name. Proposed: `ctxswitch`, matching sibling projects' lowercase single word names.

**results/<UTC timestamp>/bench.csv:** columns `mechanism,working_set_bytes,switches_per_rep,reps,ns_per_switch,nvcsw,nivcsw`, where `nvcsw` and `nivcsw` are totals across reps and include the child process for `process`. Proposed as written.

**pages/course/cisc_7310/ctxswitch/REVIEW.md:** the evidence packet. Proposed: lives beside the crate, committed, with raw `results/` for the final run committed under `results/final/`.
