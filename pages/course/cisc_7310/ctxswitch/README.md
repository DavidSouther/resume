# ctxswitch: what does a task switch cost on Linux?

An experiment for CISC 7310X ("Why a Thread Switch Is Cheaper", slide 15). It ports the
`umcontext` and `umthread` examples to Rust, adds a benchmark that compares kernel and user level
switching, and runs everything in resource limited `debian:stable-slim` containers.

```sh
tests/run.sh          # build the image, run every program and the benchmark, assert on the evidence
./scripts-dev.sh test --release     # unit tests, inside a Linux container
```

Needs Docker. The crate only builds on Linux with glibc; on macOS use the container.

## What is here

| Path | What |
|---|---|
| `src/bin/uctxswitch.rs`, `uctxmake.rs`, `uctxswap.rs`, `uctxrestore.rs` | Ports of `umcontext/*.c` |
| `src/bin/umthreaddemo.rs` | Port of `umthread/umthreaddemo.c` |
| `src/bin/switchbench.rs`, `src/bench/` | The benchmark: `thread`, `process`, `ucontext`, `regswitch`, `green`, plus two baselines |
| `src/uctx.rs`, `src/stack.rs`, `src/regswitch.rs`, `src/green.rs` | The library `unsafe` code. Every `unsafe` site, including the few in `src/bin/`, is proved in `SAFETY.md` |
| `REVIEW.md` | The evidence packet for the four questions (it does not answer them) |
| `results/final/` | Raw output of the run `REVIEW.md` cites |

## Containers

Every container is created with `--cpus=1 --cpuset-cpus=0 --memory=256m --memory-swap=256m --pids-limit=64`.
The applied limits are read back with `docker inspect` and saved next to the results. Timings from
Docker Desktop come from a Linux VM (here `6.12.76-linuxkit`, aarch64); counters and ratios are the
evidence, absolute nanoseconds are indicative. Run the same `tests/run.sh` on a native Linux host
for numbers outside a VM.

## Differences from the C originals

- Context stacks are `mmap`ed with a guard page, not `malloc` or `char[]` (an overflow faults instead of corrupting the heap).
- `getcontext` returning twice (`uctxswitch`, `uctxrestore`) runs through a small assembly routine (`run_twice`), because Rust cannot express a call that returns twice.
- `sleep` and `usleep` are `std::thread::sleep`.
- `printctx` has an aarch64 register list; the i386 branch is dropped. `uctxswap` prints Rust function addresses.
- The `umthreaddemo` exit-flag checks are kept as in the C (the `!hw_exited` test in `hello_world` is always true there).
- Each port keeps the C item order and names (`CTX`, `UCTX_FUNC1`, `make_hu_context`, ...). Comments mark the rest: `C:` quotes the statements a Rust line replaces, `Rust only:` marks code with no C counterpart. `docs/compare.html` (built by `docs/build.py`) shows them side by side.

## Attribution

- The C programs ported here are H. Chen's `OSClassExamples`
  (https://github.com/huichen-cs/OSClassExamples, `thread/unixusermode/umcontext` and `umthread`).
- The `green` mechanism and the register only switch follow the technique described in Dzania's
  "Green Threads from Scratch" (https://dzania.github.io/green-threads-from-scratch/) and its
  repository `rsroutine` (https://github.com/dzania/rsroutine): callee saved registers plus a stack
  pointer, a bootstrap trampoline, 32 KiB `mmap`ed stacks with a guard page, and a run queue with
  `yield_now`. `rsroutine` declares no license and supports Apple Silicon macOS only, so this is an
  independent implementation for Linux; no source was copied and it is not a dependency. The
  article's M:N work stealing across worker threads is not implemented.
- The unsafe audit applies Google's `unsafe_rust_review` skill
  (https://github.com/google/rust-skills/tree/main/unsafe_rust_review).
