# Context-switch cost: presentation notes

## 1. Criterion: what are we measuring?

A **handoff** is one transfer of execution from task A to task B. Report elapsed nanoseconds per handoff, with the synchronization method, CPU placement, working set, and machine specified. A round trip A → B → A is two handoffs. There is no universal context-switch constant: saving execution state is a direct cost, while scheduler/wakeup work, synchronization, and disrupted cache locality add costs that depend on the experiment.

An independent reference: Jansen, Newsome, and Wails, [USENIX ATC 2022, Figure 16](https://www.usenix.org/system/files/atc22-jansen.pdf), measured Linux **process round trips** using several synchronization methods. Their same-core Unix-domain socket result was **6.3 µs per round trip**, or about **3.15 µs per handoff**. This is an end-to-end socket-mediated handoff, not an isolated register save. It provides an external order-of-magnitude reference, not a pass/fail threshold: hardware, kernel, methodology, and virtualization differ. The authors also found that placement and synchronization change the result substantially.

For a more isolated estimate, [lmbench's `lat_ctx`](https://github.com/intel/lmbench/blob/master/src/lat_ctx.c) separately measures communication overhead and subtracts it from a process-ring measurement. Subtraction is an estimate: communication while switching can cost differently from communication without switching. A working-set sweep measures the combined cost of switching **and touching memory**, including locality effects and the touch loop itself; it does not isolate cache misses.

## 2. Our experiment and results

The Rust ports reproduce the instructor's `ucontext` examples; a separate `switchbench` compares two Linux threads, two processes, glibc `ucontext`, a register-only fiber, and a small green-thread scheduler. Two tasks share one pinned CPU. Each measured repetition performs 200,000 handoffs; the reported value is the median of five repetitions after a warmup. Kernel tasks exchange a byte through a Unix socket; each task touches its own working set. The benchmark also measures a same-thread socket baseline and records `getrusage` counters and syscall traces.

The following are EC2 runs in Debian 13 containers limited to one CPU and 256 MiB: Intel on Nov. 4, AMD and Graviton on Nov. 18. Values are µs per handoff; zero working set means no buffer touch. Raw data is under `results/aws/20261104T232346Z/` and `results/aws/20261118T223043Z/` (locally ignored by Git).

| Mechanism | Intel m7i.large | AMD c7a.large | Graviton c7g.large | What the number includes |
|---|---:|---:|---:|---|
| Linux thread | 1.704 | 5.222 | 2.476 | Socket calls, wakeup and scheduling |
| Linux process | 1.780 | 5.267 | 5.354 | Same socket handoff across processes |
| glibc `ucontext` | 0.199 | 0.576 | 0.520 | Context switch and signal-mask syscalls |
| Register fiber | 0.0108 | 0.0089 | 0.0110 | Save/restore registers and stack pointer, plus benchmark loop |
| Green scheduler | 0.0289 | 0.0258 | 0.0343 | Two fiber switches through scheduler and queue work |
| Same-thread socket baseline | 0.879 | 2.733 | 1.357 | Socket calls without a second task |

**Comparison with the independent criterion:** process handoffs of 1.78, 5.27 and 5.35 µs are approximately 0.56, 1.67 and 1.70 times the published 3.15 µs socket reference; the thread values are 0.54, 1.66 and 0.79 times it. They are all in the same microsecond range, not measurements of precisely the same hardware or operation. Subtracting the socket baseline gives rough incremental thread estimates of 2.49 µs (AMD) and 1.12 µs (Graviton); these are not pure kernel switch costs. The published comparison above uses the **unsubtracted** end-to-end values on both sides.

The user-space fibers give an engineering view of **direct control-transfer cost**: a deliberately small cooperative jump between execution contexts within one program, with no socket or kernel scheduling on each yield. They still save and restore state; green scheduling adds a queue and two raw switches, so neither is the latency of a single CPU jump instruction. At zero working set, green is about 29–34 ns and the Linux thread handoff about 1.7–5.2 µs. These are different operations with different guarantees, not an apples-to-apples kernel speedup.

At 256 KiB per task, green rises to 2.28 µs on AMD and 4.99 µs on Graviton, while thread handoffs rise to 7.49 and 7.60 µs. The buffer-touch work and memory locality now dominate much of the measurement: the tiny empty-working-set switch is not the whole application cost. We have no cache-miss counters to quantify the cause.

The Nov. 18 Intel c7i Spot request failed for insufficient capacity; the Intel m7i result above is from the Nov. 4 run. A second Nov. 4 Intel c6i run measured 1.96 µs per thread handoff and 2.06 µs per process handoff. These are medians within one run per machine, not confidence intervals across independent runs. VM scheduling, CPU architecture and container limits matter. Thread/process differences alone do not establish the cost of page-table switching or TLB misses. The benchmark does not measure creation cost or cross-core handoffs.

## 3. How the green threads work

1. `spawn` allocates a **32 KiB guarded stack**, creates a fiber with an initial frame pointing to a trampoline and task entry, and places the task in a FIFO run queue.
2. `run` takes the next task and switches from the scheduler's stack to that task's stack. Each task runs until it calls `yield_now` or finishes.
3. `yield_now` puts the current task at the back of the queue and switches to the scheduler. The scheduler picks the next task and switches to it: **task → scheduler → task**.
4. Architecture-specific assembly saves the ABI callee-saved registers and stack pointer, restores the next fiber's state, and returns into the suspended execution. The x86-64 and AArch64 frames differ. This is cooperative, not preemptive; it does not save a separate signal mask on every switch.
5. When the closure finishes, its result is stored for `JoinHandle::take`, the fiber switches back permanently, and its guarded stack can be released.

All green tasks run on one OS thread, so the kernel sees one schedulable task. A blocking syscall in one task blocks that worker; a task that never yields can starve its peers. This is a single-worker teaching implementation, not the M:N work-stealing runtime described in [Green Threads from Scratch](https://dzania.github.io/green-threads-from-scratch/). The independent implementation is in `src/green.rs`, `src/regswitch.rs`, and `src/stack.rs`.

**Suggested closing line:** “A context switch has no single price. A minimal cooperative transfer costs tens of nanoseconds in this experiment; a socket-mediated Linux handoff costs microseconds; and the memory a task touches can cost more than either.”

The assignment URL supplied for this presentation was unavailable to the research browser at preparation time, so these notes are based on the repository and the cited independent sources, not a verified reading of the assignment page.
