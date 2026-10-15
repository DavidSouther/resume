# Green threads sources

Added at the author's request, with attribution.

## Sources

- [1] Dzania, "Green Threads from Scratch", 2026-09-30, https://dzania.github.io/green-threads-from-scratch/
- [2] Dzania, `rsroutine`, https://github.com/dzania/rsroutine. GitHub reports no license (`gh api repos/dzania/rsroutine` returned `license: null`). Manifest: edition 2024, dependencies `crossbeam-deque 0.8` and `libc 0.2`.

## What they describe

- Public API: `spawn`, `yield_now`, `join`.
- Switch: `swap_context` saves callee saved registers per AAPCS64 (`x19` to `x29`, `x30`/lr, `sp`, `d8` to `d15`) at fixed struct offsets, loads the other side's, and ends with `br x30`. New tasks have `x30` pointing at a bootstrap trampoline that calls the task entry. Only the Apple Silicon macOS file `src/asm/aarch_macos.S` exists.
- Stacks: 32 KiB usable, one guard page `PROT_NONE` below it, allocated with `mmap` then `mprotect` for the usable part; `munmap` on drop (`src/stack.rs`).
- Scheduler: M:N, one worker OS thread per CPU, a global queue for new tasks, per worker local queues for yielded tasks, parked tasks for `join`, started tasks never migrate ("the compiler can't see what's on its stack").
- Limits it states: no benchmarks, learning project, "Blocking calls inside a task block the whole worker."
- Article table: green threads 32 KiB stack and no kernel trap; OS threads 2 MiB stack and kernel scheduling.

## How this experiment uses it

- The `green` mechanism in `switchbench` re-creates the technique (guarded 32 KiB stacks, run queue, `yield_now`) in Rust for Linux, single worker thread, as an independent implementation. The multi worker scheduler is deferred.
- The article's table claims are listed in `REVIEW.md` as claims to test against `regswitch`/`green` versus `thread`, not as findings.
