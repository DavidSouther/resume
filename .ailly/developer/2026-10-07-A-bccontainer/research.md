# BCDocker (CISC 7310X Project 2) — Research

*Draft 2026-10-07*

## Topic and Intent

> begin https://huichen-cs.github.io/course/CISC7310X/26FA/assignment/bccontainer and I'll be honest I'm not sure where to go beyond that? I can't tell if the assignment just wants basically a chroot jail? It seems so, so for research let's start going in that direction. Language is rust, working folder is /pages/course/cisc_7310/bccontainer, host platforms are MacOS native & Debian native, and target platforms are those and also bookworm-slim running itself in docker on Mac. The PID requirement is confusing, I'm not sure if it wants an entirely isolated process space as well? So build an isolated filesystem with /bin, parts of /etc, ??? And then start a new PID1 inside that environment?
>
> Focus on requirement gathering for now, we can go beyond this chroot idea later.

The user wants the requirements for CISC 7310X Project 2 ("BCDocker") pinned down before any design: what the assignment actually asks for, whether a chroot jail is enough, what the PID requirement means, and which of three platforms (macOS native, Debian native, `bookworm-slim` in Docker on a Mac) can meet it. The tool will be written in Rust in `pages/course/cisc_7310/bccontainer`.

## Search/Expand

Every course page the assignment links was fetched, plus the schedule's lecture for the same week. Full notes and quotes are in `research/public.md`. Sampled frames from the 110-minute tutorial video are in `research/video-frames/`.

**Short answer to "is it just a chroot jail?": No.** The assignment page says "Process IDs start from 1 in the container" [1]. The lecture slides say what the minimum is:

> "Use clone() to create a child in at least two new namespaces (e.g., PID and UTS). Demonstrate that the child sees a different view from the parent: the child is PID 1 in its own PID namespace; the child can set its own hostname without affecting the parent; (optional) the child sees its own /proc. Explain, in writing, what each flag does and what would happen without it." [2]

The same slides call for a separate filesystem root: "chroot() or pivot_root() gives the child its own filesystem root" [2]. So the minimum container is a **namespaced process (PID + UTS, plus mount so /proc can be remounted cleanly) that is also chrooted** into a hand-built root filesystem. The instructor's tutorial code uses `clone(…, CLONE_NEWNS | CLONE_NEWPID | CLONE_NEWUTS | SIGCHLD)`, `sethostname`, `chroot`, `chdir("/")`, `mount("proc", "proc", "proc", …)`, and then runs the app [3]. Your instinct ("isolated filesystem with /bin, parts of /etc, … and then start a new PID 1 inside that environment") is right. The extra piece is that PID 1 comes from a **PID namespace**, not from the chroot.

**What the PID requirement literally says and shows.** The text is one sentence: "Process IDs start from 1 in the container" [1]. The sample output narrows it down:

```
$ sudo bccontainer/bcdocker run bctinysys /bin/ps axf
  PID TTY      STAT   TIME COMMAND
   1 ?        S+     0:00 bccontainer/bcdocker run bctinysys /bin/ps axf
  14 ?        R+     0:00 /bin/ps axf
```

PID 1 is the launcher's own cloned child: it still carries the parent's argv because `clone` copies the process without an `exec`. The application is a *child* of that PID 1. The tutorial's final run shows the same shape (`1 bcdocker`, `2 bash`, `3 ps`) [3]. So the expected design is a launcher-as-init. The cloned child (PID 1 in the new namespace) does the setup, forks and execs the app, and waits for it. "An entirely isolated process space" is exactly what is required: a PID namespace in which `ps` sees only the container's processes. That works only if a fresh procfs is mounted at the container's `/proc` (pid_namespaces(7): "mount a new procfs instance at /proc so that tools such as ps(1) work correctly") [4]. The gap between PID 1 and PID 14 in the sample is unexplained; the tutorial gets 1/2/3, so the exact number does not matter.

### Requirements

E = explicit in a course source; I = inferred. Sources: [1] assignment page, [2] lecture, [3] video, [5] assignments list, [6] syllabus.

**Functional**

1. **E** — A CLI whose "usage … mirrors … Docker; … only … a small subset": `bcdocker run <container> <application> [args…]` [1]. The tutorial requires `argc >= 4` and prints usage otherwise [3].
2. **E** — Run as root via `sudo` (every example) [1]. **I** — rootless operation and user namespaces are not required.
3. **E** — Launch "a Linux application container" and run "users' Linux applications"; containers "share the same underlying operating system kernel" [1].
4. **E** — Pass application arguments through (`/bin/ls -l -t -r`) [1].
5. **E** — At least two distinct containers in the samples (`tinysys`, `bctinysys`) [1]. **I** — the container name resolves to a root-filesystem directory. The tutorial passes a path (`./tinysys`) and does `chroot(argv[2])` [3].
6. **E** — Isolated filesystem view: `ls` in the container shows only `bin etc lib proc usr` [1]; "chroot() or pivot_root()" [2].
7. **E** — "Process IDs start from 1 in the container" [1]; "the child is PID 1 in its own PID namespace" [2]. **I** (from sample output) — the launcher's cloned child is PID 1 and the app is its child.
8. **E** — `clone()` with "at least two new namespaces (e.g., PID and UTS)" [2]. **I** — CLONE_NEWNS as well, since the tutorial uses it [3] and remounting `/proc` without it would change the host's mounts.
9. **E** — The child sets its own hostname without affecting the host [2]; the tutorial uses the fixed hostname `bcdocker` [3].
10. **E (optional in [2]; shown in [1])** — `ps` inside works, i.e. procfs is mounted at the container's `/proc` [1], [2].
11. **E** — Interactive shell works and `exit` returns to the host prompt [1]. **I** — the launcher waits for the container (`waitpid`) [3]; exit status propagation is not specified.

**Container image (rootfs)**

12. **E** — "we will not automate the process; rather, we shall manually create application containers", starting from the Filesystem Hierarchy Standard (Rankin) [1]. **Source defect:** the published page breaks off mid-list here, so the step list is missing (confirmed in the raw HTML).
13. **I** — Rootfs contents implied by the samples and tutorial: `bin` (or `bin -> /usr/bin`), `usr/bin`, `lib` with `ldd`-resolved libraries and the dynamic loader, `etc`, and an empty `proc` [1], [3]. `bash`, `ls`, `ps` are the demonstrated apps.

**Deliverables and process**

14. **E** — GitHub Classroom repository: complete the survey, accept the invitation, push the work [1].
15. **E** — Top-level `README.md` ("for student information"; "concise description of your work and the layout") and `.gitignore` [1].
16. **E** — `src/` holds the source code; `doc/` holds the presentation slides [1].
17. **E** — Not a single commit: "Commit each feature completed as a single commit." A single initial commit "will be treated as incomplete" [1].
18. **E** — AI disclosure: a `Co-authored-by` trailer naming the tool on every AI-assisted commit [1]; the syllabus also asks for disclosure per assignment [6].
19. **E** — Report in the ACM or IEEE conference template, with proper citations, covering: the design of the tool, the process of creating a Linux container for an application, and lessons learned [1]. **E** — "Explain, in writing, what each flag does and what would happen without it" [2]. **I** — the report lives in `doc/`. The page names no location.
20. **E** — 10-minute in-class presentation (7 min talk, 3 min Q&A) with slides and a live demo [1].

**Schedule and grading**

21. **E** — Assigned Oct 7, 2026; due **Oct 14, 2026** ("dates … subject to change") [5].
22. **E** — Late penalty is one letter grade (10%) per day, and 0 at 5 or more days late. Projects, presentations, and papers together are 40% of the course grade [6]. No per-project rubric is published.
23. **E** — Language: "C or C++ or a language of your choice" [1], so Rust is allowed.

**Optional (not required for the minimum)**

24. **E** — `--memory=512m` (cgroup memory controller), `--pids-limit=20` (cgroup pids controller), and networking (network namespace + veth pair + NAT) [1]. The lecture lists "image pulling, overlay filesystems, networking, resource limits" as "Not required for the minimum" [2].

## Libraries & Skills

*"Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: none. No published agentic skill exists for the libraries this feature uses (`nix`, `libc`)."* This was checked, not skipped. No `SKILL.md`, MCP server, or `skills/` directory ships with `nix`, `libc`, or `caps`, and no Rust/systems skill is installed in this harness.

- **`nix` 0.31.3** [7]. `sched::{clone, unshare, CloneFlags}` (feature `sched`), `mount::{mount, MsFlags}` (feature `mount`), `unistd::{chroot, chdir, pivot_root, fork, execvp, sethostname}` (features `fs`, `process`, `hostname`), `sys::wait::waitpid`. `clone` is `unsafe` and takes a caller-allocated stack slice; nix handles stack direction [7]. The no-manual-stack alternative is `unshare(NEWPID|NEWUTS|NEWNS)` followed by `fork()`. The forked child becomes PID 1; the caller does not [4]. `sched`, `mount`, and `pivot_root` are Linux-only, so macOS builds need `#[cfg(target_os = "linux")]` gating.
- **`libc` 0.2.190**: raw fallback only.
- **Closest worked examples:** Litchi Pi's "Writing a container in Rust" (crabcan) series, which uses nix for clone and namespaces [8]; Liz Rice's "containers-from-scratch" in Go, which has the same clone + chroot + mount-proc shape as the tutorial [9]; youki, a full OCI runtime in Rust, for reference only [10].
- **Local convention** (`research/codebase.md`): `uefi_boot` uses edition 2021, few dependencies, `panic = "abort"`, and a Makefile with `install`/`build`/`run` targets that branch on `uname -s` for Darwin (Homebrew) versus Debian (apt). In that project macOS is a dev host and the real target runs elsewhere (QEMU).

## Falsification/Refine

**Claim tested: "a chroot jail satisfies the assignment."** Refuted by three independent sources: the assignment's PID requirement [1], the lecture's "at least two new namespaces" [2], and the tutorial's clone flags [3]. A plain chroot leaves the process in the host PID namespace, so `ps` would show host PIDs (or nothing, without /proc), and `sethostname` would rename the host.

**Claim tested: "all three platforms can run the container."** Refuted for macOS native:

| Platform | Namespaces (PID/UTS/mount) | chroot | Runs Linux apps | Verdict |
|---|---|---|---|---|
| **Debian native** (amd64/arm64) | Yes, with `sudo` | Yes | Yes | **Full target.** Every required and optional feature is possible (cgroup v2 for the optional limits). |
| **`debian:bookworm-slim` in Docker on Mac** | Yes. Runs on Docker Desktop's Linux VM kernel. The default seccomp profile denies `clone`/`unshare` namespace flags, `mount`, and `pivot_root` unless the container has CAP_SYS_ADMIN [11] | Yes | Yes (arm64 on Apple Silicon, so the rootfs must be arm64) | **Full target with `docker run --privileged`.** `--cap-add SYS_ADMIN` may be enough but is unverified; a fresh procfs mount can still hit EPERM in hardened setups [12]. Optional cgroup limits need a writable cgroup (privileged). |
| **macOS native** | **No.** Darwin has no PID, UTS, or mount namespaces and no `clone`/`unshare` | Yes, root only [13] | **No.** Darwin cannot exec Linux ELF binaries | **Cannot meet requirements 3, 7, 8, 9, or 10.** A Darwin chroot jail is also hard to populate: system dylibs live only in the dyld shared cache since Big Sur [14], and Apple does not support static binaries [15]. |

Honest presentation for macOS: treat it as the **dev/build host** whose runtime target is the Docker container, the same split `uefi_boot` uses with QEMU. The binary can still *compile* on macOS behind `cfg(target_os = "linux")`, and `bcdocker run` there should exit with a clear "requires Linux namespaces; use `make docker-run`" message. A chroot-only "degraded mode" on macOS would not meet the spec and would cost real effort (populating a dyld-cache jail) for no grade benefit.

**Testability.** In the agent's own Linux sandbox (root, kernel 6.18), `unshare --pid --fork --uts --mount --mount-proc` worked. Inside, `hostname` changed only in the namespace, the shell saw itself as PID 1, and `ps` listed only PIDs 1, 4, 5. `cargo`, `rustc`, and `docker` are installed. Later phases can therefore run real root-level integration tests here, not only on the user's machines.

**Size.** A single feature-sized project: one small binary (a few hundred lines of Rust), one or two hand-built rootfs directories plus the script or notes that build them, a short report, and slides. Off-the-shelf tools (`unshare(1)` + `chroot(8)`, docker, runc, youki) already do this, but the assignment exists to build it, so they serve as references only.

**Smallest version that meets the intent:** `bcdocker run <rootfs-dir> <cmd> [args…]`. It clones into new PID + UTS + mount namespaces; in the child it sets the hostname, chroots (or pivot_roots), chdirs to `/`, and mounts proc; it then forks and execs the app as a child of PID 1 and waits for it. Ship it with two hand-built rootfs directories (`tinysys` with bash/ls/ps, `bctinysys`), verified on Debian native and in privileged `bookworm-slim` on the Mac, plus the report and slides.

## Scope

**In scope for design:**
- The `run` subcommand and the PID-namespace + UTS + mount-namespace launcher with chroot (or pivot_root) and a procfs mount (requirements 1–11).
- The launcher-as-init process shape that matches the sample `ps` output.
- A manual, documented rootfs build for at least two containers, per host architecture (requirements 12–13).
- The platform strategy: Debian native and privileged Docker on Mac as runtime targets; macOS as the build host with a clean unsupported-platform exit.
- Repository and deliverable layout: README, `.gitignore`, `src/`, `doc/`, per-feature commits with AI trailers, report, and slides (requirements 14–20).

**Out of scope (deferred, per the user's "we can go beyond this chroot idea later" and the lecture's "Not required for the minimum"):** `--memory`, `--pids-limit`, networking, IPC/user/cgroup/time namespaces, image pulling, overlayfs, OCI compatibility, and rootless mode.

## Resolved Decisions

**Resolved by research**
- It is not chroot-only. A PID namespace (CLONE_NEWPID) plus UTS is the stated minimum [2]; mount namespace plus chroot and procfs are needed for the samples [1], [3].
- PID: the container gets its own PID namespace; the launcher's cloned child is PID 1 and the application runs as its child [1], [3]; `/proc` must be freshly mounted for `ps` [4].
- Rust is permitted [1]. Due date is Oct 14, 2026 [5].
- macOS native cannot host the container (no namespaces, no Linux ELF). Debian native and `bookworm-slim` in Docker (privileged) can.

**Open for the user** (most blocking first)
1. **Repository mapping.** The submission must be a GitHub Classroom repo with `README.md`, `.gitignore`, `src/`, and `doc/` at its top level, built from per-feature commits with `Co-authored-by` trailers [1]. Will `pages/course/cisc_7310/bccontainer` *be* that repo's root (for example its own git checkout, or a mirror pushed from this folder)? This decides whether the Cargo crate sits at the folder root, so that `src/` serves both Cargo and the rubric, and how commit history gets to the classroom repo.
2. **macOS role.** Accept macOS as build/dev host only, with runtime via Docker and a clear error from `bcdocker run` on Darwin? Or do you want a chroot-only degraded mode there, knowing it cannot run Linux apps or isolate PIDs?
3. **PID 1 shape.** Match the sample (launcher child is PID 1 and forks/reaps the app), or exec the app directly as PID 1 (simpler, also "starts from 1")? Research recommends matching the sample.
4. **Rootfs construction.** Hand-built `ldd`-copy rootfs, as in the tutorial and matching "manually create", built by a documented script or by hand? Is a BusyBox-static or `docker export` rootfs acceptable as a second container? Which apps beyond `bash`/`ls`/`ps`?
5. **Docker run flags.** Is `docker run --privileged` acceptable for the Mac demo, or should design aim for the minimal `--cap-add SYS_ADMIN` (+ seccomp/AppArmor adjustments) and treat it as something to demonstrate?
6. **Namespace set.** Minimum PID + UTS + mount, or also IPC (cheap, one flag) so the written "what each flag does" section covers more?
7. **Report and missing steps.** The assignment page is truncated where the "Creating a Tiny Linux System" steps should be. Ask the instructor? And confirm the report (ACM/IEEE template) goes in `doc/` beside the slides, and whether design should plan the report and slides or only the code.
8. **Host architectures.** Is the Debian machine amd64 or arm64? Apple Silicon Docker is arm64. A different architecture means the `ldd`-copied rootfs has to be built on each host, by a repeatable step, and cannot be committed once and shared.
9. **Presentation questions.** The demo must include "the discussion about the questions in this assignment" [1], but the published page has no question list (possibly lost in the truncation). Ask the instructor, or plan around the lecture's "what each flag does and what would happen without it" [2]?
10. **Optional tasks.** Confirm that `--memory`, `--pids-limit`, and networking stay deferred.

## Sources

[1] H. Chen, "Project 2: Application Container," CISC 7310X Operating Systems I, CUNY Brooklyn College, Fall 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/assignment/bccontainer (accessed Oct. 7, 2026).

[2] H. Chen, "Process Abstraction and Isolation in Linux," lecture slides, CISC 7310X, Sep. 30, 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/lecture/processisolation.pdf

[3] H. Chen, "A Tutorial for BC Docker Project (OS Application Container)," video, 2023. [Online]. Available: http://www.sci.brooklyn.cuny.edu/~chen/uploads/course/CISC7310X/video/bcdocker.html (frames at 57:00, 1:17:00, 1:32:00, 1:47:00 in `research/video-frames/`).

[4] M. Kerrisk, "pid_namespaces(7)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man7/pid_namespaces.7.html

[5] H. Chen, "Assignments," CISC 7310X, Fall 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/assignments/

[6] H. Chen, "Syllabus," CISC 7310X, Fall 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/syllabus/

[7] nix-rust, "nix" v0.31.3, docs.rs. [Online]. Available: https://docs.rs/nix/latest/nix/sched/fn.clone.html

[8] Litchi Pi, "Writing a container in Rust," blog series. [Online]. Available: https://litchipi.github.io/series/container_in_rust

[9] L. Rice, "containers-from-scratch," GitHub. [Online]. Available: https://github.com/lizrice/containers-from-scratch

[10] youki-dev, "youki," GitHub. [Online]. Available: https://github.com/youki-dev/youki

[11] Docker, "Seccomp security profiles for Docker." [Online]. Available: https://docs.docker.com/engine/security/seccomp/

[12] E. W. Biederman et al., "Re: [PATCH] [RFC][WIP] namespace.c: Allow some unprivileged proc mounts when not fully visible," LKML, Apr. 2018. [Online]. Available: https://lkml.iu.edu/hypermail/linux/kernel/1804.0/02206.html

[13] Apple, "chroot(2)," macOS System Calls Manual. [Online]. Available: https://keith.github.io/xcode-man-pages/chroot.2.html

[14] Apple Developer Forums, thread 667340 (Big Sur dynamic linker cache). [Online]. Available: https://developer.apple.com/forums/thread/667340

[15] Apple, "Technical Q&A QA1118: Statically linked binaries on Mac OS X." [Online]. Available: https://developer.apple.com/library/archive/qa/qa1118/_index.html

Additional references in `research/public.md`: namespaces(7), chroot(2) (Linux), pivot_root(2), the penumbra23 Rust runtime series, and the G. Sharma Code Mesh talk.
