# Clean Comments Review: bccontainer (bcdocker)

Scope: every comment and doc comment in `pages/course/cisc_7310/bccontainer/` outside `target/`:
`src/*.rs`, `scripts/mkrootfs.sh`, `tests/*.sh`, `Cargo.toml`. Comments were checked against
the code and, for the SAFETY block, against the vendored `nix-0.31.3/src/sched.rs`.

The SAFETY block's length is deliberate (one obligation, one piece of evidence each) and is not
counted against it. It is judged for clarity, for drift, and for references that only make sense
next to the project's process files.

Each entry gives the audience, the durable intent the comment should carry, an assessment, and an
action (keep / reduce to intent / rewrite around the invariant / remove / add).

---

## Summary, ranked

| # | Location | Problem | Action |
|---|----------|---------|--------|
| 1 | `src/sandbox.rs:54` | Security claim probably false: a self bind mount does not stop a root process escaping a chroot | Rewrite around the real reason, or remove |
| 2 | `src/sandbox.rs:81-83` | No comment on chdir → chroot(".") → chdir("/"), the classic chroot-escape guard | Add |
| 3 | `src/clone.rs:21`, `src/clone.rs:160` | Point to `design.md "Constraint for the plan"` / "accepted in design.md" (a process document) | Rewrite: point at A1 in this file |
| 4 | `src/clone.rs:15-16` | "by the one-unsafe constraint" is project jargon defined only in design.md | Rewrite: say a guard page needs more `unsafe` (mmap/mprotect) |
| 5 | `src/clone.rs:6` vs `:127`, `:151` | Audit says glibc 2.36; measurement says glibc 2.39. The code does not restrict the build to `target_env = "gnu"` | Reconcile the two versions; say musl builds are unaudited, or add a cfg guard |
| 6 | `src/sandbox.rs:41-44` | `enter`'s DocBlock describes where it is called, not its precondition (it changes the host unless run in fresh mount and UTS namespaces) | Rewrite around the precondition |
| 7 | `src/stack.rs:22` | `StackSize`'s range is a soundness invariant (E4/A1) but is documented as plain data | Rewrite: name the safety dependence |
| 8 | `src/clone.rs:76` | "`CLONE_NEWCGROUP` arrives with `--memory` and `--pids-limit`": a roadmap for features that do not exist | Remove |
| 9 | `src/clone.rs:59-68` | Provenance from the assignment and lecture ("the lecture's minimum", "the assignment does not need it") mixed into the flag rationale | Reduce to the technical reason |
| 10 | `src/stack.rs:5-6` | Copies the "64x over debug" measurement from E5; will drift | Reduce to the dependency |
| 11 | `src/supervise.rs:89-93`, `:45-46`, `src/clone.rs:78-80` | Cross-file labels (`E2 in clone.rs`, `I2 in clone.rs`) point into the numbering of a SAFETY comment | Reduce: state the fact; keep only the stable module-level labels (I1, A1) |
| 12 | `src/clone.rs:138-141` | E3's "none is held on `launch`'s path" ties the proof to one caller; it is caller guidance, not evidence | Move to the `spawn` DocBlock as a caller rule |
| 13 | `src/clone.rs:92-101` | `spawn` DocBlock leaves out "the caller must reap `pid`", which appears only in the SAFETY Postconditions | Add to the DocBlock |
| 14 | `src/supervise.rs:52-53` | No note on why the descriptors are closed after `sandbox::enter` | Add one line |
| 15 | `src/main.rs:36` | Repeats the code's order without the reason for it | Rewrite around the reason |
| 16 | `src/supervise.rs:27` | `DEBIAN_PATH` says what, not why the host PATH is replaced | Rewrite |
| 17 | `src/container.rs:14` | Credits the kernel with rules it does not make (`/` is legal in a hostname) | Rewrite |
| 18 | `src/supervise.rs:42-43` | "In order: …" retells five lines of code | Remove the first paragraph; keep the pdeathsig paragraph |
| 19 | `tests/mkrootfs_test.sh:30` | "The stubs share one body", but they have two different bodies | Rewrite |
| 20 | `tests/hardening.sh:2` | "what the design promises" refers to a process document | Reduce to the guarantees checked |
| 21 | `src/clone.rs:154-157` | E5(c) wraps mid-sentence ("It also runs the / failing-exec path") | Reflow |
| 22 | `src/clone.rs:81-82` | "`CLONE_PARENT` [is] rejected together with `CLONE_NEWPID`": check this against the kernel; the other reason given is enough on its own | Verify; drop if wrong |
| 23 | `src/launch.rs:15-21` | `waitpid(pid)` loop has no note (low; `Status::from_wait` mostly covers it) | Optional |

Everything else is keep; see below.

---

## Cargo.toml

### `Cargo.toml:10`: `# Pinned exactly: the SAFETY comment in src/clone.rs relies on nix's audited source.`
- Audience: maintainer bumping dependencies.
- Intent: the exact pin is a soundness dependency; a bump means re-auditing `nix::sched::clone`.
- Assessment: good. It explains a surprising `=` pin.
- Action: **keep**. Optionally add "re-audit `nix/src/sched.rs` before changing" so the next step is plain.

---

## src/clone.rs

### `:2` `//! The only module allowed to use \`unsafe\`.`
- Audience: module doc / maintainer.
- Intent: the single `unsafe` boundary, enforced by `#![deny(unsafe_code)]` in `main.rs` and `#[allow]` on this module.
- Assessment: true and useful.
- Action: **keep**.

### `:4-7` Invariants preamble, audit scope (glibc 2.36, Debian bookworm; musl and Android not audited)
- Audience: maintainer / auditor.
- Intent: the platforms the proof covers.
- Assessment: two problems. (a) E2 (`:127`) also says glibc 2.36, but E5(b) (`:151`) measured on **glibc 2.39**. A reader cannot tell whether 2.39 was audited or only measured. (b) Nothing in the code limits the build to `target_env = "gnu"`. `main.rs` gates on `target_os = "linux"` only, so a musl build compiles silently into unaudited territory.
- Action: **rewrite around the invariant**. Say which glibc versions the audit covers and which the measurement covers. Either add a `cfg(target_env = "gnu")` gate or state "a musl build compiles but is outside this audit."

### `:9-11` I1 (one thread)
- Intent: no thread exists at `clone`.
- Assessment: matches the code. `only_thread()` is the last call before `clone`, and only moves happen between them. The parenthetical repeats E3, which is acceptable for an invariant list.
- Action: **keep**.

### `:12` I2 (flags), `:17-18` I4 (callback), `:19-20` I5 (allocator)
- Assessment: accurate and checkable (`CLONE_FLAGS` is private; the closure is built in `spawn`; no `#[global_allocator]` in the crate).
- Action: **keep**.

### `:13-16` I3 (stack)
- Intent: stack size bounds, lifetime of the buffer, and no guard page.
- Assessment: the facts are accurate. "by the one-unsafe constraint" is a term defined only in `design.md` ("a guard page would need four more `unsafe` calls"). Someone reading only the code cannot recover it.
- Action: **rewrite**: "The `Vec` has no guard page: adding one needs `mmap`/`mprotect`, more `unsafe` than this module's single block. See A1."

### `:21-23` A1
- Intent: the one unproven assumption, and where it is measured.
- Assessment: the assumption itself is well stated. `design.md "Constraint for the plan"` is a link to a design doc and plan, and that is history: the plan will be forgotten while A1 stays true or false.
- Action: **reduce to intent**. Remove the `design.md` reference; keep "measured and tested, not proved; basis in E5; `tests/stack.sh` repeats the measurement."

### `:55-90` `CLONE_FLAGS` DocBlock
- Audience: maintainer (private const). Despite `///`, nobody calls it from outside.
- Intent: why each namespace is created, and why each sharing flag is left out.
- Assessment: mostly excellent. The "left out on purpose" list is exactly the judgment that would otherwise be lost. Problems:
  - `:59-61`, `:65-66`, `:67-68`: "the assignment's 'process IDs start from 1' and the lecture's minimum", "the lecture's second required namespace", "The assignment does not need it." These record where the requirement came from, not why the flag is technically correct. Each bullet already has the technical reason ("a process tree of its own", "`sethostname` does not rename the host").
  - `:76`: "`CLONE_NEWCGROUP` arrives with `--memory` and `--pids-limit`." Neither option exists (grep finds only this line). This is a roadmap note.
  - `:78-80`: "(E2: the child runs in a copy)" and "(I2)". The I2 reference is circular: this constant *is* I2. Pointing into E2 from a DocBlock is acceptable in the same file but adds nothing beyond "the child must run in a copy of memory."
  - `:81-82`: "`CLONE_THREAD` and `CLONE_PARENT` are rejected together with `CLONE_NEWPID`." Current kernels reject `CLONE_THREAD|CLONE_NEWPID`. `CLONE_PARENT` is rejected only when the caller is itself an init (`SIGNAL_UNKILLABLE`), not for `CLONE_NEWPID` in general. Check this against clone(2). The clause after it ("the parent must stay the child's parent to wait for it") is the reason that actually matters.
  - `:83-84`: "does not redirect stdin, stdout, or stderr" answers a misconception nobody in the code raises. It reads like the answer to a review question.
  - `CLONE_SIGHAND` is listed but has no reason (it needs `CLONE_VM`, so it falls with it).
- Action: **reduce to intent**. Remove the lecture and assignment provenance (keep the technical clauses). Remove the `--memory`/`--pids-limit` sentence. Drop "(I2)". Check the `CLONE_PARENT` claim and lean on "parent must stay the parent." Shorten `CLONE_IO` to "shares an I/O scheduler context; isolates nothing."

### `:92-101` `spawn` DocBlock
- Audience: caller (public fn).
- Intent: the soundness promise, the one-thread precondition (a runtime error), and what the caller must do with the result.
- Assessment: strong. It states a caller-facing soundness contract and the exit-status truncation. Missing: "the caller must reap `pid`" (only in the SAFETY Postconditions at `:166`). Also missing: the caller-side lock hazard from E3 (see below). Those are the two things a caller can get wrong.
- Action: **add** "The caller must `waitpid` the returned pid," plus one sentence: "Do not call while holding a std lock the child may also take; the child inherits it held."

### `:106-168` `// SAFETY:` block
- Audience: auditor / maintainer. Proof obligations with evidence, per the project rule.
- Checked against nix 0.31.3 `sched.rs`: `callback` is `extern "C" fn` calling `(*cb)()`; the stack pointer is `end - end % 16`; `combined = flags | signal`; no ptid/tls/ctid. The `cb` is moved into nix's frame and dropped when it returns. The Operation line and C3, C4 and C5 match.
- Clarity: the Operation / Required contract / Evidence / Postconditions structure is easy to follow, and the C ↔ E mapping (`=> C4` etc.) helps. Issues:
  - **E3 `:138-141`**: "none is held on `launch`'s path" ties the evidence to the current caller. The block itself says relocking is "not UB", so this clause does not discharge any obligation. It is caller guidance that will drift when callers change.
    Action: **move** to the `spawn` DocBlock as a caller rule (above) and drop it here.
  - **E5 `:151`**: "glibc 2.39, rustc 1.97 (2026-10-07)" conflicts with the glibc 2.36 audit statement (see `:4-7`). The date and toolchain are fine as provenance for a measurement, but say that the measurement and the audit used different libc versions.
    Action: **rewrite** one of the two so they agree, or explain the difference.
  - **E5 `:154-157`**: "It also runs the / failing-exec path" breaks the line mid-phrase.
    Action: **reflow**.
  - **E5 `:160`**: "C1 is NOT discharged; it rests on A1, accepted in design.md." A process reference.
    Action: **reduce** to "C1 is NOT discharged; it rests on A1 (module doc)."
  - E6 `:161-163`: accurate (abort-on-unwind out of `extern "C"` is stable since 1.81, and `rust-version = "1.96"`).
    Action: **keep**.
  - Postconditions `:164-168`: accurate. **Keep**, and copy the "caller must reap" item into the DocBlock as noted.
- Overall action: **keep**, with the four edits above.

### `:173-177` `only_thread` DocBlock (`# Safety-usable invariant`)
- Audience: maintainer / auditor (private fn whose result `unsafe` depends on).
- Intent: exactly when it returns `Ok`.
- Assessment: precise, and it names the procfs check that keeps a fake `/proc` from passing.
- Action: **keep**.

### `:181`, `:185` inline `// not procfs, or unreadable: refuse` / `// more than one thread, or /proc unreadable: refuse`
- Assessment: these repeat the DocBlock four lines above. They are harmless but say nothing new.
- Action: **remove** (or keep one). Low priority.

### `:218-219` test comment: nix's `CloneFlags` cannot name `CLONE_SETTLS` etc.
- Checked: nix 0.31.3 comments out `CLONE_SETTLS`, `CLONE_PARENT_SETTID`, `CLONE_CHILD_CLEARTID` and `CLONE_CHILD_SETTID`, and has no `CLONE_PIDFD`.
- Assessment: accurate. It explains why the test does not assert their absence.
- Action: **keep**.

---

## src/sandbox.rs

### `:1` module doc
- Action: **keep**.

### `:24` `DevNode`, `:31` `DEV_NODES` "The devices every OCI runtime provides."
- Intent: the device set follows an external standard.
- Assessment: accurate (the OCI runtime spec's default devices). This is the right kind of external-constraint note.
- Action: **keep**.

### `:41-44` `enter` DocBlock
- Audience: caller (public fn).
- Intent: the precondition. `enter` must run inside fresh mount and UTS namespaces, or it sets the host's hostname and mount state. Also the postcondition: the rootfs on disk is left unchanged.
- Assessment: "Runs in the cloned child, before the application starts" describes the current call site, not a contract. The sentence that matters ("Every mount lives in the private mount namespace") only holds if the caller arranged that, and the DocBlock does not say so. The "rootfs directory itself is never written" sentence is a good, tested postcondition (`tests/run.sh:63-65`).
- Action: **rewrite around the invariant**: "Must be called in a process that has its own mount and UTS namespaces (see `clone::CLONE_FLAGS`); otherwise it changes the host. Leaves the rootfs directory on disk unchanged: …"

### `:50` `// Stop mount propagation, or everything below leaks to the host.`
- Assessment: correct and necessary. A new mount namespace inherits shared propagation.
- Action: **keep**.

### `:54` `// A mount point of its own, so the chroot below is a root the container cannot leave by name.`
- Intent: why the rootfs is bind-mounted onto itself.
- Assessment: **probably wrong, and it is a security claim.** `chroot` escape does not depend on whether the new root is a mount point. Path resolution stops `..` at the process root either way. A root process with `CAP_SYS_CHROOT` (the container runs as root) can still break out with the classic `mkdir x; chroot x; cd ../../..`, mount point or not. A self bind mount is what `pivot_root` needs, and it makes the later `proc`/`dev` mounts attach under a mount that exists only in this namespace. Neither of those is "cannot leave by name." A wrong security comment is worse than none: the next maintainer will believe the chroot is escape-proof.
- Action: **rewrite** to the real reason (or **remove** the line if there is no functional reason). Consider adding the known limit: "chroot does not contain a root process; this is not a security boundary."

### `:68` `// mknod applies the umask; the nodes must be 0666. Restore it for the application.`
- Intent: why the umask is 0 here (the item the caller asked about).
- Assessment: present and correct. It names the surprising interaction and the restore.
- Action: **keep**.

### `:81-83` chdir(root) → chroot(".") → chdir("/") (**no comment**)
- Intent: `chroot` does not change the working directory. Changing directory into the root first, then to `/` afterwards, makes sure the working directory is inside the new root. A working directory left outside it is the textbook chroot escape.
- Assessment: this is the most surprising sequence in the file, and its reason is not in the code. A tidy-up could easily "simplify" it to `chroot(root)`.
- Action: **add** one line: "chroot does not move the working directory; enter the root first and land on `/` so no cwd is left outside it."

---

## src/supervise.rs

### `:1` module doc
- Action: **keep**.

### `:27` `DEBIAN_PATH` "The `PATH` the application sees: Debian's default."
- Intent: why the host `PATH` is replaced while other variables pass through (`tests/hardening.sh:36-38` checks both).
- Assessment: says what, not why. The reason is that the host's `PATH` (sudo's secure_path, Homebrew or Nix directories) names host directories that mean nothing inside the rootfs.
- Action: **rewrite**: "Replaces the host's `PATH`, whose directories need not exist in the rootfs; Debian's default matches the images `mkrootfs.sh` builds. Other variables pass through."

### `:30-31` `container_main` DocBlock
- Assessment: a good caller contract (where errors are printed, and status 1).
- Action: **keep**.

### `:42-49` `supervise` DocBlock
- First paragraph ("In order: ask for SIGKILL…, enter…, close…, start…, then reap") retells the five statements below it.
  Action: **remove**.
- Second paragraph (pdeathsig fires on thread exit; by I1 that is the only thread; the remaining window; why the getppid check does not work in a new PID namespace). This is durable, non-obvious judgment and it is correct. "I1 in `clone.rs`" names a stable, module-level invariant, so the cross-reference is acceptable.
  Action: **keep**.

### `:52-53` order of `sandbox::enter` then `close_extra_fds` (**no comment**)
- Intent: why the descriptors are closed after the sandbox and not first.
- Assessment: the order matters. After `enter`, `/proc/self/fd` is read from the container's own procfs, and any descriptor the setup opened is included. If a reader moves the call earlier, nothing warns them.
- Action: **add** one line at the call: "After `enter`: lists through the container's `/proc` and also closes anything setup left open."

### `:60` `// Orphans are reparented to PID 1: wait for any child, and finish with the application's.`
- Intent: why the loop uses `waitpid(None)` (the item the caller asked about).
- Assessment: present, correct, and tested (`tests/hardening.sh:40-46`).
- Action: **keep**.

### `:71-72` `open_fds_above` DocBlock
- Assessment: "The directory handle … is closed again before this returns" is the invariant `close_extra_fds` relies on.
- Action: **keep**.

### `:86-93` `close_extra_fds` DocBlock
- First paragraph (the `fchdir` escape through an inherited host directory descriptor): an excellent why.
  Action: **keep**.
- Second paragraph: the facts are right (no live owner of an fd above 2 in the child; the `ReadDir` fd gives `EBADF`; `CLONE_FILES` is excluded). "(E2 in `clone.rs`)" and "(I2 in `clone.rs`)" point at a numbered item *inside a SAFETY comment* in another file. E-numbers are the most fragile labels in the project: they change whenever the proof is reorganised.
  Action: **reduce**. State the fact ("the child never returns into the parent's frames, so nothing here owns those descriptors") and point at `clone::spawn` by name instead of `E2`. "`CLONE_FILES` is excluded from `CLONE_FLAGS`" needs no label.

---

## src/stack.rs

### `:1` module doc
- Action: **keep**.

### `:5-6` `MIN` "A1 in `clone.rs` claims … with a margin of 64x over the depth measured in a debug build (`tests/stack.sh`)."
- Intent: `MIN` is load-bearing for soundness; lowering it weakens A1.
- Assessment: the dependency is the right thing to say. "64x over the depth measured in a debug build" copies a number from E5 and design.md, and it will drift when someone measures again.
- Action: **reduce to intent**: "The floor A1 in `clone.rs` depends on; lowering it weakens that argument. `tests/stack.sh` fails at `MIN / 16`."

### `:8` `DEFAULT`, `:10-11` `MAX`
- `MAX`'s "reserved, not committed, but a limit keeps a typo from asking for terabytes" is a good why.
- Action: **keep** both.

### `:22` `StackSize` "A stack size in bytes, between `MIN` and `MAX`."
- Intent: this range is a type invariant that `clone::spawn`'s SAFETY (E4, A1) depends on. The private field and `parse` enforce it.
- Assessment: it describes the range as plain data. The next maintainer, adding a `From<usize>` or a `const fn new`, has no warning that they would break a soundness proof.
- Action: **rewrite around the invariant**: "Always within `MIN..=MAX`; `clone::spawn`'s safety argument relies on the lower bound, so every constructor must check it."

### `:27` `parse`, `:66` `Human`
- Action: **keep**.

---

## src/launch.rs

### `:1` module doc
- Action: **keep**.

### `:15-21` `launch` loop (**no comment**)
- Assessment: `waitpid(pid, None)` without `WUNTRACED` returns only for termination in practice, so the loop is defensive. `Status::from_wait`'s doc ("other statuses are not final") covers the reason.
- Action: optional. **Add** nothing, or "loop: non-final statuses are skipped."

---

## src/main.rs

### `:2-3` crate doc
- Action: **keep**.

### `:36` `/// Order of checks: usage, platform, root, then the container.`
- Intent: why usage comes first. Bad arguments print usage even on macOS or as a non-root user, and the container lookup comes last because it touches the filesystem.
- Assessment: it repeats the order the code already shows and leaves out the reason, which is the part a reader cannot see.
- Action: **rewrite**: "Usage errors are reported first, on any platform and without root, so a typo never shows up as a privilege error."

---

## src/error.rs

### `:1-2` "Every leaf message starts with its step, so `main`'s line reads `bcdocker: <step>: <reason>`."
- Checked: every leaf `#[error]` across the modules starts with a step (`usage`, `container`, `clone`, `wait`, `mount`, `sethostname`, `chroot`, `mknod`, `prctl`, `close fds`, `exec`, `stack size`). Pass-through variants are `transparent`.
- Assessment: a durable convention that new variants must follow.
- Action: **keep**.

---

## src/cli.rs

### `:1` module doc; `:20` `Args` "as typed, before the container is looked up"
- Action: **keep**. The second distinguishes `Args` from `Run`.

### `:29-30` `parse` DocBlock
- First clause repeats the usage string (also in `Error::Usage`). Second sentence ("Options come before the container; everything after the application is the application's own arguments") is the caller contract, and tests cover it.
- Action: **reduce to intent**: keep the second sentence only.

### `:32` `// the program name`
- Assessment: tiny, and explains a bare `skip(1)`.
- Action: **keep**.

---

## src/container.rs

### `:1` module doc; `:39` `resolve` DocBlock
- Assessment: `resolve` states the path rule exactly, and the tests check it.
- Action: **keep**.

### `:14` `Hostname` "A hostname the kernel accepts: 1 to 64 bytes, no NUL and no `/`."
- Assessment: attributes project rules to the kernel. The kernel limit is the 64 bytes (`HOST_NAME_MAX`). `/` is legal in a kernel hostname and is excluded here because the name comes from a path component. NUL is excluded for C-string safety.
- Action: **rewrite**: "At most 64 bytes (the kernel's limit), non-empty, with no NUL or `/` (it comes from a directory name)."

### `:69` test `Scratch` doc
- Action: **keep**.

---

## src/status.rs

### `:1` module doc, `:9` `from_wait`
- Assessment: accurate. It states the shell's 128+signal convention and which statuses are final.
- Action: **keep**.

---

## scripts/mkrootfs.sh

### `:2-9` header
- Assessment: usage, defaults, the tool fallback, and the atomic-rename guarantee (tested by `mkrootfs_test.sh:62-72`) all match the code.
- Action: **keep**.

### `:22` "Docker and crane both need the platform spelled out: crane defaults to linux/amd64."
- Action: **keep**. External-tool behaviour that justifies the `case`.

### `:42` "mktemp creates the directory 0700; it becomes the container's /."
- Action: **keep**. It explains a `chmod` that would otherwise look arbitrary.

---

## tests/run.sh

### `:2-12` header
- Assessment: "the primary user story" is mild process language, but the next paragraph states the user-visible behaviour concretely.
- Action: **keep** (optionally drop "the primary user story").

### `:24`, `:30`, `:38`, `:50-65`, `:67` inline
- Assessment: the numbered step comments structure a long script, and the per-check comments say what each check means. `:63` ("setup left the rootfs's /proc an empty directory") ties directly to the `sandbox::enter` postcondition.
- Action: **keep**.

## tests/hardening.sh

### `:2` "Hardening checks for bcdocker: what the design promises beyond the feature test."
- Assessment: "what the design promises" sends the reader to a process document.
- Action: **reduce to intent**: "Isolation guarantees beyond `run.sh`: inherited descriptors, PATH, orphan reaping, and parent death."

### `:7` "Shares target/test-work with run.sh and builds its container if it is absent."
- Action: **keep**. A shared-state contract between scripts.

### `:29-30`, `:36`, `:40-41`, `:45`, `:48-49`
- Assessment: each explains a non-obvious test technique (`ls` as a child of `sh`; `grep -l`'s exit status; starting with `&` so `$!` is bcdocker itself).
- Action: **keep**.

## tests/mkrootfs_test.sh

### `:2` header, `:22`, `:47`
- Action: **keep**. `:47` (the minimal PATH hides the host's docker) is a good why.

### `:30` "The stubs share one body: record the call, answer info, export a tar."
- Assessment: drift. `docker` and `crane` have different bodies (only docker answers `info`/`create`/`rm`).
- Action: **rewrite**: "Each stub logs its call and exports the fixture as a tar; docker also answers info, create and rm."

## tests/stack.sh

### `:2-14` header
- Assessment: names A1 (a stable module-level label), the guard-page reason, the limit, and the debug-build caveat. Good.
- Action: **keep**. Optionally drop "(1 MiB)" so `MIN` lives in one place.

### `:21` `limit_kb` comment, `:33-39` `touched` explanation, `:68` `check_touched` usage, `:83`
- Assessment: the pagemap method (bits 63/56, counting downward from the stack pointer, independence from how the kernel merges mappings) is exactly the kind of non-obvious technique that needs prose.
- Action: **keep**.
