# Evidence packet: kernel versus user-level task switching

This document collects evidence for four questions. It does not answer them. Each section lists what was observed, where the raw output is, where to look next, and an empty line for the answer.

All numbers are from `results/final/` (one run of `tests/run.sh`) on Docker Desktop, a Linux VM (`6.12.76-linuxkit`, aarch64, 8 CPUs), in `debian:stable-slim` (Debian 13) containers created with `--cpus=1 --cpuset-cpus=0 --memory=256m --memory-swap=256m --pids-limit=64` (read back in `results/final/programs/limits.inspect.json`). Other runs during this session (not kept) gave 851 to 1173 ns for `thread` where this one gave 865 ns, so treat absolute nanoseconds as indicative and compare mechanisms within one run. Run the same `tests/run.sh` on a native Linux host to remove the VM.

## What was run

| Program or mechanism | What it is | Source |
|---|---|---|
| `uctxswitch`, `uctxmake`, `uctxswap`, `uctxrestore` | Rust ports of `umcontext/*.c`, with register dumps | `src/bin/`, outputs in `results/final/programs/` |
| `umthreaddemo` | Rust port of `umthread/umthreaddemo.c`, a round robin scheduler over two `ucontext` "threads" | `src/bin/umthreaddemo.rs` |
| `thread` | Two threads of one process pinned to one CPU, a 1 byte token over a socket pair; every handoff blocks one thread and wakes the other | `src/bench/mod.rs` |
| `process` | The same with the peer in a separate process (re-executed `switchbench --peer`) | same |
| `ucontext` | Two glibc contexts handing control with `swapcontext`, in one thread | `src/bench/user.rs` |
| `regswitch` | Two flows handing control with a hand written switch that pushes the callee saved registers and swaps the stack pointer | `src/regswitch.rs` |
| `green` | Two green tasks that `yield_now` to each other through a run queue and scheduler loop, on 32 KiB guarded stacks (technique from Dzania, "Green Threads from Scratch" and `rsroutine`) | `src/green.rs` |
| `baseline-socket` | One thread writes and reads its own socket pair: the same system calls per handoff as `thread`, no task switch | `src/bench/mod.rs` |
| `baseline-sigprocmask` | Two `rt_sigprocmask` calls per handoff (what `strace` shows for one `swapcontext` on this aarch64 image), no switch | same |

A "handoff" is one transfer of control from one flow to the other. For `thread` and `process` it is one socket `sendto` by one side and the matching `recvfrom` (which blocks) by the other, so each row's `ns per switch` includes those two system calls and the wakeup; `baseline-socket` is the same two calls with no second task. Each row is the median of 5 repetitions of 200000 handoffs, after one unrecorded warmup repetition. "Working set" is a private buffer touched one byte per 64 byte line before each handoff, equal for every mechanism. The five ported programs sleep, so they supply no cost data; `switchbench` links the same `ucontext` code they use.

## Results (aarch64 VM, `results/final/bench.csv`)

| Mechanism | ns per switch, working set 0 | 32 KiB | 256 KiB | Kernel voluntary context switches per handoff (all runs) | Kernel involuntary switches (total) |
|---|---|---|---|---|---|
| `thread` | 865 | 995 | 3762 | 1.00 | 100063 (ws 0) |
| `process` | 975 | 1047 | 3835 | 1.00 | 174228 (ws 0) |
| `ucontext` | 307 | 447 | 3359 | 0 | 6 |
| `regswitch` | 14.8 | 163 | 3127 | 0 | 0 |
| `green` | 41.1 | 167 | 2912 | 0 | 1 |
| `baseline-socket` | 437 | n/a | n/a | 0 | 6 |
| `baseline-sigprocmask` | 295 | n/a | n/a | 0 | 5 |

Voluntary switches per handoff are `nvcsw` divided by 1,200,000 (6 repetitions of 200000) for working set 0. The `ucontext` row is close to the `baseline-sigprocmask` row; the `thread` row minus the `baseline-socket` row is 428 ns. Those two subtractions are arithmetic on this table, not a finding.

## 1. What state is saved and restored in a kernel thread context versus a user-level thread context?

Observed.
- A glibc `ucontext_t` is 4560 bytes on aarch64 (968 on x86_64), of which 128 bytes are the signal mask (from the `libc` crate type definitions, via `cargo test --release sizes -- --nocapture`; output in `results/final/sizes.txt`). On aarch64 `mcontext_t` ends in a 4096 byte reserved area (libc definition) and the printed registers are `PC`, `SP`, `X0` to `X28`, `FP`, `LR` (the C original has no aarch64 branch; its fallback is i386); on x86_64 the C `printctx` list (`RIP RAX RSP RBP RAX RBX RCX RDX RSI RDI`, RAX printed twice in the original).
- `regswitch` saves a 176 byte frame on aarch64 (48 bytes on x86_64): the callee saved integer registers, `lr`, and on aarch64 `d8` to `d15`. The stack pointer is the whole handle. It does not save the signal mask or the floating point control register.
- `uctxmake` register dumps before and after `makecontext` differ in `PC`, `SP`, `X19`, `X20`, `FP` and `LR` (`results/final/programs/uctxmake.txt`).
- `strace -c` of `ucontext` shows 40001 `rt_sigprocmask` calls for 20000 handoffs (`results/final/strace/ucontext.txt`); `regswitch` and `green` show none in the loop.
- For the kernel thread, the blocked task's `/proc/<pid>/task/<tid>/syscall` file prints a syscall number and six argument registers (`207 0x4 0xffff97a8e63c 0x1 ...`), and `wchan` prints `unix_stream_read_generic` (`results/final/proc/thread.txt`). `/proc/<pid>/task/<tid>/stack` was denied in the container, so the kernel stack is not captured.
- Not captured: what the kernel saves for a thread (its `pt_regs`, per thread CPU context, floating point or SIMD state, thread pointer). Only source pointers are available, below.

Where to look (recalled from memory, not opened in this session, verify before citing).
- glibc: `swapcontext`, `getcontext`, `setcontext` assembly under `sysdeps/unix/sysv/linux/aarch64/` and `.../x86_64/`; `man 3 getcontext`, `man 3 swapcontext`, `man 3 makecontext`.
- Linux: `context_switch()` and `__schedule()` in `kernel/sched/core.c`; `__switch_to` and `cpu_switch_to` under `arch/arm64/`; `__switch_to_asm` under `arch/x86/entry/entry_64.S`; `struct pt_regs`; `man 5 proc` for `/proc/<pid>/syscall`.

**For you to answer:**

## 2. What does the kernel see in each case?

Observed (`results/final/proc/`, `bench.csv`, `strace/`).
- `thread`: `/proc/1/task/` lists 2 tasks, `Threads: 2`. While sampled one was `State: R (running)` and one `S (sleeping)`, with per task `voluntary_ctxt_switches` of 269661 and 293748 and `nonvoluntary_ctxt_switches` of 34343 and 10228 at sample time.
- `ucontext` and `green`: 1 task, `Threads: 1`, `State: R (running)`, `syscall` file reads `running`, `voluntary_ctxt_switches` 14 and 16, `nonvoluntary_ctxt_switches` 63 and 58 after about 2 million handoffs.
- `getrusage` totals for the whole `bench.csv`: user mechanisms recorded 0 voluntary switches in every row; kernel mechanisms recorded about 1.2 million per row (1.00 per handoff).
- System calls per handoff (`strace -c -f`, 20000 handoffs): `thread` 20001 `recvfrom` and 20000 `sendto`; `process` the same plus `wait4`; `ucontext` 40001 `rt_sigprocmask`; `regswitch` and `green` none in the loop.
- `process`: involuntary switches were higher than `thread` in the working set 0 row (174228 versus 100063); the child's counters come from `RUSAGE_CHILDREN`.

Where to look. `man 5 proc` (`status`, `syscall`, `wchan`, `stack`), `man 2 getrusage` (`ru_nvcsw`, `ru_nivcsw`), `man 7 sched`, `man 2 rt_sigprocmask`; `strace -c`.

**For you to answer:**

## 3. Why is the user-level switch cheaper?

Observed.
- Ratios at working set 0 (this run): `thread` / `regswitch` is about 58; `thread` / `ucontext` about 2.8; `thread` / `green` about 21; `ucontext` / `regswitch` about 21.
- At working set 32 KiB: `thread` 995, `ucontext` 447, `regswitch` 163, `green` 167. At 256 KiB: 3762, 3359, 3127, 2912. The gap between `thread` and `regswitch` is 850 ns, 832 ns and 635 ns across the three sizes.
- `green` costs more than `regswitch` at working set 0 (41.1 versus 14.8) and about the same at 32 KiB and 256 KiB. One `green` handoff is task, scheduler, task (two raw switches plus run queue work).
- `baseline-socket` (the two system calls without a task switch) costs 437 ns; `baseline-sigprocmask` (the signal mask calls without a switch) costs 295 ns.
- `process` costs 975 ns versus 865 ns for `thread` at working set 0 (difference 110 ns), 1047 versus 995 at 32 KiB, 3835 versus 3762 at 256 KiB.
- Another run (not kept) gave `thread` 1173 ns and kept the same order of rows at working set 0.
- Not measured: thread or context creation cost; cross CPU wakeups; cache or TLB miss counters (no `perf` in the container).

Where to look. The `Row` definitions and loops in `src/bench/`; lmbench `lat_ctx`; the article's table (32 KiB green stack versus 2 MiB OS thread stack, "no kernel trap") is quoted, not observed here; only the system call counts above bear on it.

**For you to answer:**

## 4. How does this connect to the "Why a Thread Switch Is Cheaper" slide 15 from the deck?

The slide (PDF page 20, footer 15 / 29; verbatim in `.ailly/developer/2026-10-14-A-task-switching-cost/research/slide-15.md` in this repository) says a thread switch (same address space) saves registers, switches the stack pointer and reloads the TCB, with no page table switch and no TLB flush; a process switch adds a switch to a different page table; and "the user-visible benefit ('threads are cheaper') comes from a kernel-level fact (no address-space switch)". Slide 16 proposes measuring switches between two processes and two threads at working sets 0, 32 KB and 256 KB; slide 25 says user threads are "cheaper to create and switch" and that "the kernel sees only one schedulable entity".

Observations relevant to those statements (no mapping is asserted).
- "Thread versus process" (the slide's own contrast) is the `thread` and `process` rows: 110 ns, 52 ns and 73 ns apart at 0, 32 KiB and 256 KiB, with the same per handoff kernel switch count. This machine is an aarch64 VM; whether a page table switch is visible here at all is not established by this run.
- `regswitch` saves a 176 byte frame (aarch64) and its rows show 0 kernel context switches.
- `/proc` lists 1 task for `ucontext` and `green`, and 2 for `thread`; per handoff cost is in the table above.
- Slide 25's "cheaper to create" and "blocking call blocks all threads" are not measured. `green` runs on one worker thread; a blocking call inside a task was not exercised.
- The Dzania article describes an M:N scheduler with a worker per CPU; this experiment implements only the single worker case.

Where to look. Slides 14 to 16 and 25 of the deck; `research/slide-15.md`; the process variant's page table behaviour on aarch64 (address space identifiers) is a point to verify before claiming a mechanism.

**For you to answer:**

## Limits of this evidence

- One machine, one VM, one run per section above; no confidence intervals beyond the median of 5.
- Register lists are from glibc on Debian 13 (trixie) aarch64; `ucontext_t` sizes are from the `libc` crate's type definitions; the `x86_64` build was compile and correctness checked under emulation only (no timing).
- The unsafe code was audited twice by an independent model reviewer (`SAFETY.md`); this is not a human audit. `cargo clippy` and Miri were not run (Miri does not model `getcontext`).

## Attribution

Ported programs: H. Chen, `OSClassExamples` (https://github.com/huichen-cs/OSClassExamples). Green threads and register switch technique: Dzania, "Green Threads from Scratch" (https://dzania.github.io/green-threads-from-scratch/) and `rsroutine` (https://github.com/dzania/rsroutine), reimplemented here without copying code (no license declared). Unsafe review method: Google, `unsafe_rust_review` (https://github.com/google/rust-skills/tree/main/unsafe_rust_review).
