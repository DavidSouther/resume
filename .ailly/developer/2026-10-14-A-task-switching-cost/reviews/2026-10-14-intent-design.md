# Intent review: design phase

Reviewed: `design.md` (Draft 2026-10-14) and feature test `pages/course/cisc_7310/ctxswitch/tests/run.sh`. Anchor: verbatim request in `research.md` Topic and Intent, plus its Resolved Decisions. Cold dispatch. Category for all: Design assumption. Status: open, awaiting human answers.

Excluded as already raised in `reviews/2026-10-14-intent-research.md`: Docker Desktop VM as "production", benchmark instead of instrumented ports, quickloop breadth, SKILL.md versus README, one sided saved-state evidence, thread versus process on slide 15.

Excluded as resolved by the request or artifact: fork variant and sweeps (Resolved Decisions), x86_64 timing (Deferred), `sched_yield` and cross CPU variants (Open for the human).

## 1. The feature test encodes an expected answer as a pass condition

- As designed, the program will exit non-zero (no `ok`) when `regswitch < ucontext < thread` does not hold at working set 0, from a single run of five medians with no recorded spread. `design.md` calls a contradiction "itself evidence", but `run.sh` treats it as failure of the experiment.
- Request: "Do not answer the following questions. Instead, prepare sufficient documentation for me to review and provide the answer."
- Is a surprising ordering (noisy VM, a cheap `thread` handoff, a `ucontext` slower than expected) meant to fail the whole run, or should it be recorded and reported while the test still passes? As written, a run that honestly measures an unexpected result is red, and a run that confirms the slide's story is green, so the test grades the course story instead of checking that evidence was produced. It can also fail from VM noise alone, unrelated to the request.

## 2. REVIEW.md can go green while stating answers, or while the audit never happened

- As designed, the test checks that `REVIEW.md` exists, contains four heading substrings, and has four lines starting `**For you to answer:**`. It does not check that the section is empty of conclusions, that "Evidence" entries point at files that exist, or that the unsafe audit table exists.
- Request: "Do not answer the following questions" and "Apply ... unsafe_rust_review ... before finishing the port."
- Is that sufficient? A `REVIEW.md` that answers all four questions, or that links nothing, passes. The unsafe review, an explicit request step, has no assertion at all (no audit table, no `# Safety` presence check, no check that unsafe is confined to two modules as `design.md` specifies). Do you want the test to enforce "no conclusions, resolvable evidence links, audit recorded", or is human review of those the intended gate?

## 3. The headline kernel versus user-level number includes socket I/O, not just a switch

- As designed, `thread` and `process` cost is a socket pair handoff (two syscalls, a wakeup, a task switch per handoff). `ucontext` and `regswitch` cost is a function call into a switch routine. `baseline-socket` and `baseline-sigprocmask` are recorded, but `run.sh` asserts only that their rows exist; the ordering check uses raw `ns_per_switch`.
- Request: "Why is the user-level switch cheaper?" and "What state is saved and restored in a kernel thread context versus a user-level thread context?"
- Is the raw gap between `thread` and `regswitch` the quantity you want to explain? Much of it is the pipe/socket path and scheduler wakeup, not saved state. Should the packet present a baseline subtracted figure as the primary comparison (and say what remains), or leave subtraction to the author? The choice changes which of the four answers the numbers appear to support.

## 4. "What does the kernel see" is tested only by counting tasks

- As designed, the kernel view test passes when `thread` shows at least two `status` blocks and `ucontext` shows exactly one. It does not assert that `syscall`, `wchan` or `stack` blocks were captured, or that they hold anything. `/proc/<tid>/stack` normally needs root plus kernel stack tracing, and `syscall` needs ptrace access to the target; either can return empty or permission errors in a Docker Desktop container without failing the test.
- Request: "What does the kernel see in each case?"
- Could this pass with an evidence file that shows task counts but no saved registers or blocked-in-syscall state? Is a task count (one schedulable entity versus two) enough evidence of "what the kernel sees", or must the saved-register and wait-channel data be present and non-empty for the test to pass?

## 5. "debian:stable-slim with explicit resources" is verified by configuration, not by enforcement or image

- As designed, `run.sh` reads `docker inspect` `HostConfig` limits, and the `limits` container runs `cat /proc/self/cgroup` with output and exit status discarded. It never asserts the runtime image's base is `debian:stable-slim`, nor that limits bind inside the container (cgroup `cpu.max`, `cpuset.cpus.effective`, `memory.max`). The strace runs also add `--cap-add=SYS_PTRACE`, an extra capability beyond the stated resource profile, and use 20000 switches against a threshold of 20000 `rt_sigprocmask` calls, so a lost count at the boundary fails for unrelated reasons.
- Request: "Use debian:stable-slim docker containers with explicit resources."
- Is a green config readback acceptable proof, or should the test show that limits and base image are real inside the running container (and that a changed Dockerfile base would turn the test red)? Is the added `SYS_PTRACE` capability in strace containers acceptable, or should syscall evidence come from a profile identical to the benchmark's?

## 6. "Port ... behavior for behavior" is checked by a few greps, never against the C originals or on both architectures

- As designed, parity means matching message text, call order for `uctxswap`, and counts (20 and 10 lines). Register dump content is checked only by two header lines for `uctxmake`; no register name or value shape is asserted, and nothing is compared to output from the upstream C. `design.md` Journey step 3 promises matching register dumps on `x86_64` and `aarch64`, but `run.sh` has no `x86_64` path and Deferred says `x86_64` is correctness only under emulation.
- Request: "Port umcontext and umthread to Rust."
- Is message and ordering parity enough, or should the port be demonstrated against C output (for example by building the upstream C in the same image and diffing normalized output), and should `x86_64` correctness be in the feature test given that `printctx` upstream targets `x86_64` first? Today a port that prints an empty register block, or no `x86_64` support at all, can pass.
