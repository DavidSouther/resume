# Intent review: design.md and tests/run.rs (Design-phase variant, cold)

*Anchor: research.md "Topic and Intent" verbatim quotes (no `.ailly/prompts/` file supplied), plus the user's later decisions as relayed verbatim: (1) "Yes, one thin audited unsafe is appropriate." (2) "Drop the project submission concerns, I'll handle that later." (3) "The chroot can be the extracted files from bookworm-slil." (4) "The rest of the questions are uninteresting, remove them and the research that lead to them." (5) "Use thiserror for typed errors throughout the project." (6) nix chosen over rustix and rolling our own.*
*Dispatch note: cold, memory-less reviewer. Questions were formed from design.md, research.md, and tests/run.rs alone; prior entries (IR-1 to IR-9) were read only afterwards for dedup. None of them overlapped. All nine are research-phase entries and are closed.*

Candidates dropped as already settled: clone versus clone3 (research and Deferred), `pivot_root` versus `chroot` (Deferred), the pty (out of scope), the launcher as PID 1 with the application as PID 2 (research requirement 5 and the sample output), stdio inheritance and descriptor hygiene (IR-7, research scope), and the 128-plus-signal exit status (research I/O section, in scope).

---

### 2026-10-07 — IR-10 — Design assumption: Docker's reserved exit codes 125, 126, and 127

As designed, the program will reserve exit codes 125 (setup failure), 126 (not executable), and 127 (not found), following Docker's convention, and the feature test asserts all three. The original request asked for "safe rust, clone and chroot sys calls, and preparing an appropriate chroot". Research recorded the exit status as "unspecified" and said that on failure the child "prints the typed error to stderr and exits 1". The reserved codes are new scope, and they still overlap the application's own exit codes: an application that exits 125 looks the same as a setup failure. They also add an Open Artifact Decision and README documentation. Is that what you intended, or should failures exit 1 with the typed error on stderr, as research proposed, and leave the Docker convention out?

**Status:** resolved, closed 2026-10-07 (design and test revised to remove or constrain the scope in question)

### 2026-10-07 — IR-11 — Design assumption: signal forwarding and the PID 2 fork may need `unsafe` beyond the one clone module

As designed, PID 1 will fork the application, forward `SIGINT`, `SIGTERM`, and `SIGHUP` to it, and reap orphans, and the host-side `bcdocker` will ignore `SIGINT` while it waits. In nix 0.31, `unistd::fork`, `sys::signal::signal`, and `sys::signal::sigaction` are all `unsafe fn`. The design names only one `#[allow(unsafe_code)]` module, the `clone` one, and does not say how these steps avoid `unsafe`. You decided "Yes, one thin audited unsafe is appropriate." Safe routes exist: `std::process::Command` to spawn PID 2, and `SigSet::thread_block` with `SigSet::wait` or `signalfd` instead of handlers. The design commits to none of them. Should the design state that PID 1 uses only safe APIs for spawning and signals, so `clone` remains the single `unsafe` site? Or is a second audited site acceptable? Or should signal forwarding be cut back to the research's minimum, where the parent "decides whether to ignore SIGINT and SIGTERM or forward them"?

**Status:** resolved, closed 2026-10-07 (design and test revised to remove or constrain the scope in question)

### 2026-10-07 — IR-12 — Design assumption: an architecture stamp written into the rootfs

As designed, `mkrootfs.sh` will write `containers/<name>/.arch`, and `bcdocker` will read it before `clone` and refuse a rootfs built for a different architecture. Because the file sits in the rootfs, the container also sees it as `/.arch`. You said "The chroot can be the extracted files from bookworm-slil". Research says only that the rootfs "must match the target's architecture" and that each host builds its own. The stamp, its error path, and its Open Artifact Decision are new scope, and they leave the chroot slightly different from the plain extracted files. Is that what you intended, or should a mismatched rootfs be allowed to fail with `Exec format error`, as any chroot would?

**Status:** resolved, closed 2026-10-07 (design and test revised to remove or constrain the scope in question)

### 2026-10-07 — IR-13 — Design assumption: the application's environment is cleared

As designed, the application's environment will be cleared down to `PATH`, `HOME=/root`, `HOSTNAME`, and `TERM`. No request asked for this. Research's in-scope list (stdio, descriptor hygiene, redirection, exit status, signals) does not include environment handling, and research never raised it. The tutorial and the assignment pass the environment through. Is that what you intended, or did decision 4 ("the rest of the questions are uninteresting") mean the environment should be inherited unchanged?

**Status:** resolved, closed 2026-10-07 (design and test revised to remove or constrain the scope in question)

### 2026-10-07 — IR-14 — Design assumption: `mkrootfs.sh` location versus `$BCDOCKER_HOME`, and the test that depends on it

As designed, `scripts/mkrootfs.sh <name>` "creates `containers/<name>/`". Only `bcdocker run` is specified to resolve names under `$BCDOCKER_HOME`. The feature test runs `mkrootfs.sh` with `BCDOCKER_HOME` set to the cargo target tmpdir and then expects `bcdocker` to find `bctest` there. If the script follows the design text, it writes `./containers/bctest` in the project directory, and every run returns the "container directory missing" error. More broadly, the request and research describe `bcdocker run <container>` that resolves to a directory. The `$BCDOCKER_HOME` override and the rule that a `/` makes the argument a path are added scope. Should `mkrootfs.sh` honor `$BCDOCKER_HOME`, as the test assumes? And did you want the environment-variable override at all, or would a fixed `./containers` plus explicit paths be enough?

**Status:** resolved, closed 2026-10-07 (design and test revised to remove or constrain the scope in question)

### 2026-10-07 — IR-15 — Research gap: the "explain what each flag does" deliverable disappeared from design

As designed, the program will pass `CLONE_NEWPID | CLONE_NEWNS | CLONE_NEWUTS | CLONE_NEWIPC | SIGCHLD`. The design never says where each flag's explanation lives, or why each sharing flag stays off. The original request asked to "discuss clone vs clone3, flag choices". Research's in-scope list includes "the full flag explanation", and the lecture requires one: "Explain, in writing, what each flag does and what would happen without it." Is that explanation code documentation, such as module docs on the `unsafe` clone module or a README section, which would put it in the design? Or is it report material, covered by "Drop the project submission concerns, I'll handle that later"?

**Status:** resolved, closed 2026-10-07 (design and test revised to remove or constrain the scope in question)

### 2026-10-07 — IR-16 — Design assumption: Verification and Metrics promise more than the feature test checks

As designed, Verification says the feature test checks "every exit code in the table", and Metrics say "no mounts, files, or hostname changes remain on the host". The test checks the hostname but not leftover mounts. It does not check the not-root, wrong-architecture, or usage (exit 2) cases. It also does not check the `/dev` tmpfs, the IPC namespace, the cleared environment, the closing of host descriptors, or that the rootfs is unmodified after a run. The original request named "clone and chroot sys calls, and preparing an appropriate chroot". Is the feature test meant to cover only the primary journey, leaving the rest to later unit or step tests? If so, should Verification say so? Or should the test also assert, at least, no leftover mounts in `/proc/self/mountinfo` and no inherited descriptors above 2?

**Status:** resolved, closed 2026-10-07 (design and test revised to remove or constrain the scope in question)

### 2026-10-07 — IR-17 — Design assumption: a Makefile alongside cargo

As designed, the project will ship a `Makefile` with `build` and `run` targets that branch on `uname -s`, copied from `uefi_boot`'s convention. The original request and the later decisions never ask for one. Cargo already builds on both hosts, `mkrootfs.sh` covers the rootfs, and the run command needs `sudo` and a container name that a fixed `run` target would have to guess. Is that what you intended, or should the crate be cargo-only?

**Status:** resolved, closed 2026-10-07 (design and test revised to remove or constrain the scope in question)
