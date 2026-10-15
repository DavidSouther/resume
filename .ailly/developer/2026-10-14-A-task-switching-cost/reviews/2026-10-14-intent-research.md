# Intent review: research phase

Reviewed: `research.md` (Draft 2026-10-14). Anchor: verbatim request in Topic and Intent. Cold dispatch. Status: open, awaiting human answers.

Form: inside the frame built, what would we no longer notice is missing? The request implies [Z]; the research oriented around [W].

## 1. "In production" became Docker Desktop on a VM

- Research orients around: containers on a Docker Desktop linuxkit VM (aarch64, 6.12.76), results reported as "indicative".
- Request: "Run them (in production)."
- Claim: all reported numbers will come from a virtualized aarch64 guest on a laptop, never from a native Linux host, and the REVIEW.md will treat ratios and counters as the evidence. Is that what you meant by "in production", or did you intend a native Linux x86_64 host (the architecture the upstream `printctx` targets)? Orienting on "containers only" makes a host choice invisible.

## 2. The ported programs are not what gets measured

- Research orients around: a new `switchbench` binary with four mechanisms.
- Request: "Port umcontext and umthread to Rust... Run them... Using the results, explain and contrast".
- Claim: the five ported programs will be run only for behavioral parity (they `sleep(1)` and `usleep(50ms)`, so they produce no cost data), and every number used in the explanation will come from a separate program that was not in the request. Is a new benchmark what you intended as "the results", or did you expect the ports themselves (for example `umthreaddemo`) to be instrumented and timed?

## 3. Scope versus "quickloop"

- Research orients around: five ports, four mechanisms, three working set sizes, baselines, `strace -c`, `/proc` views, an unsafe audit table, and a REVIEW.md.
- Request: "quickloop an experiment".
- Claim: the plan will carry a fourth mechanism (fork plus socketpair process handoff), working set sweeps, and two architectures, none of which the request names. Is that breadth intended for a quickloop, or should the process variant and sweeps be cut to the minimum that answers the four questions?

## 4. "README" was replaced by SKILL.md, applied by a cold reviewer

- Research orients around: `SKILL.md` as the operative text, saved verbatim, applied to a cold reviewer subagent during the plan's audit step.
- Request: "Apply https://github.com/google/rust-skills/blob/main/unsafe_rust_review/README.md before finishing the port."
- Claim: the audit will not follow the README you linked, and will be performed by a subagent instead of by the porting agent in-line. Is substituting SKILL.md, and an independent auditor, acceptable, or did you want the README's own steps followed as written?

## 5. Evidence for "what state is saved" and "what the kernel sees" is mostly timing and counters

- Research orients around: per-switch nanoseconds, `ru_nvcsw`/`ru_nivcsw` deltas, syscall counts, `/proc` thread views.
- Request: "What state is saved and restored in a kernel thread context versus a user-level thread context? What does the kernel see in each case?"
- Claim: the packet will contain register dumps only for the user-level side (`printctx`, `ucontext_t` fields), and nothing that shows what the kernel saves for a kernel thread (kernel stack, `pt_regs`, FPU/SIMD state, TLS base, signal mask), so question 1 will be a one-sided comparison. Do you want a kernel-side state artifact (for example a documented source pointer to `switch_to`, or an eBPF/ftrace capture, if available in a container), or is source citation enough?

## 6. Slide 15 contrasts thread with process; the request contrasts kernel thread with user-level

- Research orients around: adding a process mechanism so "slide 15's thread versus process contrast is measurable".
- Request: "How does this connect to the 'Why a Thread Switch Is Cheaper' slide 15".
- Claim: the slide's page table switch argument concerns thread versus process, while your four questions contrast kernel versus user-level, so the packet will map slide 15 to the process variant and to slide 25 for the user-level case. On an aarch64 guest with ASIDs, and with working sets of 0, 32 KB and 256 KB, a page table switch cost may not be measurable at all. Is the connection you want "user-level avoids the kernel" (slide 25 territory), or "thread avoids the address-space switch" (slide 15), and should a null process result be reported as such?
