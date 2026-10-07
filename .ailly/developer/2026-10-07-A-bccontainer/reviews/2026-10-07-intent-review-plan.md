# Intent review: plan.md (Plan-phase, cold)

*Anchor: research.md "Topic and Intent" verbatim quotes (no `.ailly/prompts/` file supplied), then design.md, then `pages/course/cisc_7310/bccontainer/tests/run.sh`, plus the user's later decisions as relayed verbatim: (1) "Yes, one thin audited unsafe is appropriate." (2) "Drop the project submission concerns, I'll handle that later." (3) "The chroot can be the extracted files from bookworm-slil." (4) "The rest of the questions are uninteresting, remove them and the research that lead to them." (5) "Use thiserror for typed errors throughout the project." (6) nix chosen over rustix and rolling our own. (7) "Feature test should be in bash." (8) "Design decisions are resolved, remove the section."*
*Dispatch note: cold, memory-less reviewer. Questions were formed from plan.md, design.md, research.md, and tests/run.sh; prior entries IR-1 to IR-17 were read afterwards for dedup. All prior entries are closed.*

Candidates dropped as already settled: signal forwarding (design Out of scope; the plan adds none), reserved exit codes (IR-10; the plan exits 1), the architecture stamp (IR-12; the plan keeps the architecture implicit), the Makefile and README (IR-17; the plan adds neither), the environment (IR-13; the plan inherits it and sets only `PATH`, as the design says), `std::process::Command` for PID 2 (IR-11; the design's constraint), and `unsafe` outside the clone module. Checked against the nix 0.31.3 source: `sched::clone` is the only `unsafe fn` the plan calls. `unistd::close` (generic over `IntoRawFd`, which `RawFd` implements), `sys::stat::mknod`, `sys::stat::makedev` (a safe `const fn`), `sys::wait::waitpid`, `sys::prctl::set_pdeathsig`, `mount::mount`, `unistd::sethostname`, and `unistd::chroot` are all safe.

Trace of `tests/run.sh` against Steps 1 to 4: every check passes after Step 4 once two outline defects are fixed. First, `mkrootfs.sh` calls `mktemp -d "containers/.$name.XXXXXX"` before any `mkdir -p containers`, so a fresh `target/test-work` fails at the test's first step. Second, `clone::spawn` takes a `'static` `Box<dyn FnMut() -> isize>`, but `launch(run: &Run)` captures a borrowed `&Run`, which does not compile. nix's `CloneCb<'a>` allows the borrow. PID 1 is the cloned `bcdocker` with no exec, so `/proc/1/comm` reads `bcdocker`. `Command::spawn` makes `/bin/sh` PID 2. The probe's `$(cat …)` children are reaped before the glob runs, so `seen` is `1,2`. `$HOSTWORK` does not exist inside the bookworm-slim root, so the probe prints `hostfs=sealed`. `kill -9 $$` kills PID 2, PID 1 maps the kill to 137 and exits with it, and the host sees `Exited(137)`. Spawn failures surface as `Error::Exec` naming the app. The mounts live in the private namespace, so the rootfs `proc` directory stays empty.

---

### 2026-10-07 — IR-18 — Plan scope: a second shell test script, `tests/hardening.sh`

As planned, Step 5 adds `tests/hardening.sh`, a second end-to-end script beside the feature test. It checks descriptors above 2, `PATH`, `FOO=bar` inheritance, orphan reaping, a close-on-exec descriptor, and that killing the host-side `bcdocker` ends the container. Step 6 then requires it to print `ok` on both targets. The design's Verification lists only the feature test as automated, plus manual runs. Under IR-16 the feature test was constrained, and inherited descriptors were left out of it. The design promises these behaviors ("It sees no other host file descriptors", "reaps any orphaned processes", "The container also ends if the host-side `bcdocker` is killed") but never says they get a test. The script also depends on the `bctest` rootfs that `run.sh` builds, and the plan does not say so. You asked for "safe rust, clone and chroot sys calls, and preparing an appropriate chroot", and decided "Feature test should be in bash." Do you want a second permanent test script as new verification surface? Or should Step 5's checks be by-hand step tests, as Step 3's are, or rolled into `run.sh`?

**Status:** resolved, closed 2026-10-07 (plan revised)

### 2026-10-07 — IR-19 — Plan scope: the macOS build is deferred to the last step, as a conditional fix

As planned, Steps 0 to 5 declare `nix` as an ordinary dependency and use `nix::sched`, `nix::mount`, and `nix::sys::prctl`, which exist only on Linux. Only Step 6 says to "wrap Linux-only modules in `cfg(target_os = "linux")` … if the check fails". The check will fail: those modules do not compile on Darwin. So from Step 3 onward the crate does not build on the Mac, and Step 1's `NotLinux` path cannot be exercised on the only platform where it fires. You named "host platforms are MacOS native & Debian native". The design's journey starts "`cargo build`. A macOS build succeeds". Research says to declare `nix` under `[target.'cfg(target_os = "linux")'.dependencies]`. Should Step 1 set up the target-specific dependency and the `cfg` split, with a non-Linux `launch` stub, so every step leaves the crate building on both hosts? Or is a Mac build that breaks mid-plan acceptable?

**Status:** resolved, closed 2026-10-07 (plan revised)

### 2026-10-07 — IR-20 — Plan scope: a stubbed-tool test file for the rootfs script, `tests/mkrootfs_test.sh`

As planned, Step 2 adds `tests/mkrootfs_test.sh`. It puts stub `docker` and `crane` binaries on `PATH` and checks the build into place, refusal to overwrite, cleanup after a failure, the crane fallback, and the error when neither tool exists. Every one of these is a promise in the design's "Building a rootfs" paragraph, and the feature test exercises only the happy path. That justifies a step test. The plan does not say whether the file stays as a permanent artifact that Step 6 runs, or serves only while Step 2 is built. You decided "Feature test should be in bash", and the file is bash. Is a permanent second test file under `tests/` what you intended? Or should these edge cases be checked once by hand?

**Status:** resolved, closed 2026-10-07 (plan revised)

### 2026-10-07 — IR-21 — Plan scope: where the `--privileged` hint appears under unprivileged Docker

As planned, the `--privileged` hint appears in `NotRoot`, and Step 4 expects that "under unprivileged Docker … the first `Mount` error names `/`, and the message suggests `--privileged`". Under Docker's default seccomp profile, though, a `clone` with namespace flags fails with `EPERM` before any mount runs (research, Docker privileges). A default `docker run` is also root, so `NotRoot` does not fire. The first error is therefore `Error::Clone`, and the plan gives it no hint. The design's failure table says "Not root or missing privilege → … under Docker, the message suggests `--privileged`". Should the hint attach to a `Clone` `EPERM`, which is the case a student will actually hit, and should Step 4's edge case be corrected to expect it?

**Status:** resolved, closed 2026-10-07 (plan revised)

### 2026-10-07 — IR-22 — Plan scope: one crate-wide `Error` enum instead of one per module

As planned, the crate has a single `Error` enum in `src/error.rs`. Research's Typed errors section says "Each module has one error enum", and the design says `src/` holds "the error enums". You decided "Use thiserror for typed errors throughout the project." One flat enum satisfies that wording, but it differs from the per-module layout that research and design describe. Is one enum what you intended?

**Status:** resolved, closed 2026-10-07 (plan revised)
