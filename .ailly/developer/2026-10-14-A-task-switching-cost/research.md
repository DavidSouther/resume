# Research: Linux task switching cost (kernel threads versus user-level contexts)

## Topic and Intent

Original request, verbatim:

```
quickloop an experiment for linux task switching cost. Use debian:stable-slim docker containers with explicit resources.

Port [umcontext](https://github.com/huichen-cs/OSClassExamples/tree/main/thread/unixusermode/umthread) and [umthread](https://github.com/huichen-cs/OSClassExamples/tree/main/thread/unixusermode/umthread) to Rust. Apply https://github.com/google/rust-skills/blob/main/unsafe_rust_review/README.md before finishing the port. Run them (in production). Using the results, explain and contrast:

Do not answer the following questions. Instead, prepare sufficient documentation for me to review and provide the answer.

What state is saved and restored in a kernel thread context versus a user-level thread context?
What does the kernel see in each case?
Why is the user-level switch cheaper?
How does this connect to the “Why a Thread Switch Is Cheaper” slide 15 from the [deck](https://huichen-cs.github.io/course/CISC7310X/26FA/lecture/thread.pdf)?
```

Goal in plain terms: a reproducible measurement of what a Linux task switch costs, using the course's own ucontext examples ported to Rust, run in resource-limited `debian:stable-slim` containers, plus an evidence packet (not answers) that lets the course author write the four answers.

## Search/Expand

- Both links in the request name the same directory (`thread/unixusermode/umthread`). The upstream repository has two sibling directories: `umcontext` (four small programs and a shared register printer) and `umthread` (one cooperative scheduler demo). Both were read in full from `raw.githubusercontent.com`; the port covers all of them. See `research/upstream-sources.md`.
- `umcontext`: `uctxswitch` (getcontext then setcontext back to it, a context that "returns twice"), `uctxmake` (getcontext, point at a fresh stack, makecontext, setcontext), `uctxswap` (two functions swapping through swapcontext with `uc_link`), `uctxrestore` (getcontext loop with `sleep(1)`), and `printctx` (dumps RIP, RAX, RSP, RBP, RBX, RCX, RDX, RSI, RDI on x86_64, with an i386 branch).
- `umthread`: `umthreaddemo.c`, a round robin dispatcher in `main` that `swapcontext`s into two cooperative "threads" (20 and 10 iterations, 50 ms `usleep` each), with an exit flag per thread.
- Slide 15 of the deck is PDF page 20, titled "Why a Thread Switch Is Cheaper" in the "Kernel Perspective" section. Its claim: a thread switch saves registers, switches the stack pointer and reloads the TCB, with no page table switch; a process switch adds a page table switch; "the user-visible benefit comes from a kernel-level fact (no address-space switch)". The following slide (16/29) sets up a context switch cost project: vary working set size 0, 32 KB, 256 KB, measure per-switch cost. The kernel/user thread slide (25/29) says user threads are "cheaper to create and switch" and that the kernel "sees only one schedulable entity". Verbatim text is in `research/slide-15.md`.
- glibc `swapcontext` and `getcontext` save and restore the signal mask with a `rt_sigprocmask` system call. This is the single most important fact for the experiment, because it means glibc's "user-level" switch is not purely user-level. It is to be confirmed with `strace` in the container, not assumed. A hand written register-only switch is the clean user-level reference.
- Green threads (added at the author's request). "Green Threads from Scratch" by Dzania (2026-09-30) [6] and its repository `dzania/rsroutine` [7] build a user level runtime in Rust: `spawn`, `yield_now`, `join`; hand written `swap_context` that saves only AAPCS64 callee saved state (`x19` to `x30`, `sp`, `d8` to `d15`) and `br x30` into the resumed task; 32 KiB `mmap`ed stacks with a `PROT_NONE` guard page; one worker OS thread per CPU with a global queue and per worker local queues (M:N), and tasks pinned to the worker that started them. The article reports no benchmarks, says "Blocking calls inside a task block the whole worker", and calls itself a learning project. Its assembly exists for Apple Silicon macOS only (`src/asm/aarch_macos.S`), so it cannot run in a Linux container, and the repository states no license (GitHub reports none). Consequences: the technique is ported with attribution as an independent implementation for Linux (`aarch64` and `x86_64`), no source is copied, and `rsroutine` is not a dependency. Notes are in `research/green-threads.md`.
- Measurement prior art: lmbench `lat_ctx` (pipe token passing between processes or threads, working set sizes), which is also what slide 16 sketches.

## Libraries & Skills

Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: none are loadable as a harness skill. The one relevant published skill is Google's `unsafe_rust_review` (`https://github.com/google/rust-skills/tree/main/unsafe_rust_review`). The README named in the request is only background and attribution; the operative text is `SKILL.md` in the same directory, saved verbatim at `research/unsafe-rust-review-SKILL.md`. It is applied as a document to a cold reviewer subagent in the plan's audit step rather than loaded as a harness skill.

- `libc` crate: `ucontext_t`, `getcontext`, `setcontext`, `makecontext`, `swapcontext` if exported for `linux-gnu`; otherwise a local `extern "C"` block. `sched_setaffinity` is covered by `nix`.
- `nix` (already used by `bccontainer`): safe `sched_setaffinity`, `getrusage` with `RUSAGE_THREAD`/`RUSAGE_SELF`, `sigprocmask`.
- std only for threads, timing, `UnixStream::pair` (safe kernel-mediated handoff).
- No published agentic skill ships with `libc`, `nix` or std. That is a finding.

## Falsification/Refine

- Size: one feature, a single crate. Nothing off the shelf does this: lmbench measures processes and pthreads, not ucontext, and does not port the course examples.
- Smallest honest version: port the five C programs one for one, add one benchmark binary with five mechanisms (kernel thread handoff, kernel process handoff, glibc `swapcontext`, a bare register-only switch, and a green thread runtime in the style of [6] and [7] that adds a run queue, `yield_now` and guarded stacks on top of that switch) and three working set sizes, run in a pinned, memory-limited `debian:stable-slim` container.
- Falsifying the obvious story: if the story is "user-level is cheaper because there is no kernel", then glibc `swapcontext` should show a floor of one syscall per switch, and the assembly switch should be far below it. If that does not hold, the explanation expected on the slide is incomplete. Measuring both is what lets the author see that.
- Falsifying "the kernel sees nothing": per-process `ru_nvcsw`/`ru_nivcsw` deltas (what the scheduler counts) should be about N for the kernel mechanism and about zero for both user-level mechanisms. This is recorded per run.
- Docker Desktop on this host is a Linux VM (kernel `6.12.76-linuxkit`, aarch64, 8 CPUs). Absolute nanoseconds include virtualization effects and are reported as indicative; ratios and counters are the evidence. The Dockerfile pins `--cpuset-cpus` so both kernel threads share one CPU.
- Slide 15 mentions page table switch and TLB behavior. Two threads of one process cannot demonstrate the process side. A two process variant of the kernel mechanism (fork plus socketpair) is in scope as a fourth mechanism so slide 15's thread versus process contrast is measurable, not asserted.

## Scope

In:
- Rust port of `umcontext` (4 programs plus register printer) and `umthread` (1 program), behavior for behavior, for `aarch64` and `x86_64` Linux glibc.
- `switchbench`: kernel thread handoff, kernel process handoff, glibc ucontext switch, register-only switch, green threads (run queue plus `yield_now`, one worker thread so the kernel still sees one task); working sets 0, 32 KB, 256 KB; baselines for the non-switch work in each handoff.
- Dockerfile (build stage on a Rust image, run stage `debian:stable-slim`), explicit `--cpus`, `--cpuset-cpus`, `--memory`, `--memory-swap`, `--pids-limit`.
- `strace -c` evidence of syscalls per mechanism, and `/proc` thread views.
- `unsafe` audit against `unsafe_rust_review`, recorded as a table of every unsafe site.
- `REVIEW.md`: for each of the four questions, the evidence, source pointers and the open decision. It does not answer them.

Out:
- Answers to the four questions.
- Preemptive user threads, signals based scheduling, `clone` based threads, real time scheduling classes.
- The M:N multi worker scheduler and work stealing of [6] (a single worker keeps one kernel visible task; multi worker adds kernel threads and is deferred).
- macOS native execution (`ucontext` is deprecated and incompatible there). Containers only.
- Performance tuning of Docker Desktop's VM.

## Resolved Decisions

- Port location: `pages/course/cisc_7310/ctxswitch/`, next to the sibling `psstat` and `bccontainer` projects.
- Kernel handoff uses `UnixStream::pair` ping pong (safe std), with the kernel counters recorded alongside timing.
- glibc `swapcontext` and a register-only switch are both measured; the difference is itself evidence.
- "In production" means optimized (`--release`) binaries in resource limited containers, not a debug build. The Dockerfile is architecture neutral, so the same `tests/run.sh` can be run on a native Linux `x86_64` host to get numbers outside the Docker Desktop VM; this session's numbers come from the aarch64 VM and are labelled so.
- The five ported programs are parity artifacts: they sleep, so they produce no cost data. Cost numbers come from `switchbench`, which links the same `ucontext` module the ports use, so the measured code is the ported code.
- Evidence for saved state and kernel visibility is two sided. User side: `ucontext_t` register dumps from the ports. Kernel side: `/proc/<tid>/{stat,status,syscall,wchan,stack}` for tasks blocked in a handoff (the `syscall` file prints the user registers the kernel holds for a blocked task), plus source pointers (`switch_to`, `struct pt_regs`, `struct thread_struct`, `switch_mm`) listed in `REVIEW.md` as not yet verified by the author.
- Slide 15 contrasts thread with process; the four questions contrast kernel with user-level. The packet maps both: the `thread` versus `process` rows serve slide 15 and the `thread` versus `ucontext` and `regswitch` rows serve slides 15 and 25. A null result for the page table switch (ASIDs on aarch64, small working sets) is reported as a null result, not asserted away.
- `SKILL.md` is the operative text behind the README the request links; the README itself is attribution only. An independent cold auditor applies it, because generation (the porter) is a poor judge of its own safety proofs.
- Open for the human: whether a `sched_yield` based kernel variant is also wanted; whether to add a cross-CPU placement variant. Both are cheap to add and are deferred.

## Sources

- [1] H. Chen, OSClassExamples, `thread/unixusermode/umcontext` and `umthread`, https://github.com/huichen-cs/OSClassExamples
- [2] H. Chen, "Thread", CISC 7310X lecture deck, https://huichen-cs.github.io/course/CISC7310X/26FA/lecture/thread.pdf, slide 15/29 (PDF page 20), slides 16 and 25.
- [3] Google, `unsafe_rust_review`, https://github.com/google/rust-skills/tree/main/unsafe_rust_review
- [4] `getcontext(3)`, `makecontext(3)`, `swapcontext(3)`, Linux man-pages.
- [6] Dzania, "Green Threads from Scratch", 2026-09-30, https://dzania.github.io/green-threads-from-scratch/
- [7] Dzania, `rsroutine`, https://github.com/dzania/rsroutine (no license declared; technique only, no code reused)
- [5] L. McVoy and C. Staelin, "lmbench: Portable Tools for Performance Analysis", USENIX 1996.
