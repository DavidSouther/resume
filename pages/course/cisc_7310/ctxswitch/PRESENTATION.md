# Context-switch cost: presentation notes

## 1. 2007 -> 2026

**What contributes to context switching costs?** A handoff transfers execution from A to B; A → B → A is two handoffs. There is no single price. The cost depends on the switch mechanism, the workload and the machine.

Distinguish two parts:

- **Direct cost:** executing the handoff: saving and restoring state, scheduler work, and, where applicable, kernel entry, synchronization and wakeup.
- **Indirect cost:** the subsequent work affected by the handoff, such as cache and TLB misses as the incoming task resumes. What ran in between, working-set size and access pattern all matter.

These are measurement categories, not perfectly separate hardware events. Interrupts and system calls can also perturb a task without switching to another task. A raw switch count is not a latency measurement.

## 2. The historical starting point

In 2007, Li, Ding and Shen used communicating processes and a single-process control to estimate switch cost while varying array size and access stride. On their 2 GHz Pentium Xeon, their direct estimate was **3.8 µs**. Their synthetic total estimates ranged from several microseconds to more than **1 ms**, depending on the workload. When competing working sets crossed cache capacity, the measured overhead rose sharply; it did not rise monotonically for every larger array. Those are results for their machine and synthetic benchmark, not a prediction for ours. [Li, Ding and Shen, *Quantifying the Cost of Context Switch*](https://www.cs.rochester.edu/u/kshen/papers/expcs2007.pdf)

The distinction still matters. Modern processors can retain translations using address-space tags; Linux's x86 page-table-isolation documentation describes PCIDs and the additional work of its security mitigation. A 2025 serverless scheduling preprint also finds substantial scheduler overhead at high levels of cgroup colocation, a different source of cost from cache warmup. Neither result supplies a universal per-switch price. [Linux PTI documentation](https://kernel.org/doc/html/v5.18/x86/pti.html); [Isstaif, Kalyvianaki and Mortier](https://arxiv.org/abs/2508.15703)

## 3. What the program compares

The Rust examples port the instructor's `ucontext` demonstrations. `switchbench` compares five paths on a pinned CPU:

| Mechanism | One handoff | What distinguishes it |
|---|---|---|
| Linux thread | One thread wakes the other using a socket | Kernel scheduling within one process |
| Linux process | One process wakes the other using a socket | Separate address spaces as well as kernel scheduling |
| `ucontext` | One user context resumes another | glibc context state and signal-mask system calls |
| Register fiber | A flow directly switches to a known peer | Cooperative register and stack-pointer transfer |
| Green thread | A task yields through a FIFO scheduler to another task | Queue work and two register-fiber switches |

The socket paths include communication and wakeup; the user-space paths do not perform equivalent work or provide identical guarantees. Their differences show the costs of these **complete paths**, not a general kernel-versus-user speedup.

A register fiber supplies the switching mechanism: save callee-saved registers, save the stack pointer, load the other stack, restore registers, and return into the suspended flow. A green thread is a scheduled task built on that mechanism: `task A → scheduler → task B`. Each task has a guarded stack; this implementation has one OS worker and cooperative scheduling. A task that blocks the worker or never yields prevents its peers from running. [Implementation: `src/regswitch.rs`, `src/green.rs`]; [Green Threads from Scratch](https://dzania.github.io/green-threads-from-scratch/)

## 4. What the completed run shows

The Nov. 18 EC2 run completed on Intel c7i, AMD c7a and Graviton c7g. Each result is the median of five repetitions of 200,000 planned handoffs after warmup, in a Debian 13 container limited to one CPU and 256 MiB. Each task touched one byte per 64 bytes using read-modify-write. There is one run per machine; the raw AWS files are locally ignored. Values below are µs per handoff at zero working set.

| Mechanism | Intel c7i | AMD c7a | Graviton c7g |
|---|---:|---:|---:|
| Linux thread | 1.732 | 5.241 | 2.498 |
| Linux process | 1.796 | 5.148 | 5.089 |
| glibc `ucontext` | 0.219 | 0.574 | 0.520 |
| Register fiber | 0.0125 | 0.0093 | 0.0116 |
| Green scheduler | 0.0317 | 0.0266 | 0.0362 |
| Socket control | 0.899 | 2.726 | 1.360 |

These show inexpensive cooperative transfers and microsecond-scale socket handoffs in these particular runs. An independent reference measured a same-core Unix-socket **process round trip** of 6.3 µs, or 3.15 µs per handoff; its hardware, kernel and methodology differ. [Jansen, Newsome and Wails, USENIX ATC 2022, Fig. 16](https://www.usenix.org/system/files/atc22-jansen.pdf)

At 256 KiB per task, green elapsed time was 2.35 µs on AMD and 4.94 µs on Graviton; thread handoff time was 7.57 and 7.92 µs. **Those numbers include the array-touch work.** The matching controls below estimate the increment under their assumptions; the run did not collect cache-miss counters.

## 5. How the revised experiment separates costs

The revised benchmark keeps the paired handoff and adds controls at each size: a single task touches one hot buffer with no handoff, and a socket control also performs reads and writes without a second task. It varies working-set size, byte stride and read versus read-modify-write access. `analyze.py` computes:

```text
estimated total(size) = handoff-and-work(size) − matched control(size)
estimated increment   = estimated total(size) − estimated total(0)
```

The zero-size difference is a direct-path **baseline estimate**. The increment is an estimate of additional cost under this particular control, not a direct cache-miss measurement: the control uses one hot buffer, whereas alternating tasks have private buffers, and its socket read does not block or wake a peer. Preserve negative values; noise and imperfect controls can produce them. The completed run includes controls for 0, 32 KiB and 256 KiB, at one 64-byte write stride.

The control-subtracted **increment above zero**, in ns per planned handoff, is:

| Mechanism / working set | Intel c7i | AMD c7a | Graviton c7g |
|---|---:|---:|---:|
| Thread / 32 KiB | 458.6 | −224.8 | 36.1 |
| Thread / 256 KiB | 67.6 | 80.7 | −81.3 |
| Register fiber / 32 KiB | 277.7 | 8.0 | 40.1 |
| Register fiber / 256 KiB | −1.2 | 12.8 | 253.8 |
| Green / 32 KiB | 263.8 | 13.5 | 46.0 |
| Green / 256 KiB | 11.3 | 95.4 | 45.1 |

These are differences of independently measured medians, not confidence intervals. The negative values are not evidence of negative cache cost; they illustrate noise and imperfect matching. Three sizes and one access pattern cannot characterize a cache-capacity curve.

Report planned handoffs separately from voluntary and involuntary kernel switches. The revised CSV pairs counters with the median timed repetition, although their snapshots do not have identical boundaries. Repeat runs, record CPU and cache topology, and corroborate with scheduler tracing and cache/TLB counters where supported. Compare application throughput and tail latency before drawing production conclusions. [`lmbench` `lat_ctx`](https://lmbench.sourceforge.net/man/lat_ctx.8.html) is a useful independent benchmark with a work control.

**Closing:** “The handoff is only the beginning of the measurement. Its direct path can be small, but the work that resumes afterward—and the scheduler load around it—determines what the application actually pays.”
