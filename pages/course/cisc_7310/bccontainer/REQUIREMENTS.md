# BCDocker: Requirements

Status: research draft, 2026-10-07. Source assignment: [1]. Nothing here is implemented yet.

## Short answer: is this a chroot jail?

Partly. The filesystem half is a chroot. The PID half is not.

The assignment requires that "Process IDs start from 1 in the container" [1], and shows `ps axf` inside the
container listing only the container's processes [1]. A chroot "changes an ingredient in the pathname resolution
process and does nothing else" [2]. It does not renumber processes. A `/proc` mounted inside a plain chroot shows
every host process, because "a /proc filesystem shows only processes visible in the PID namespace of the process
that performed the mount" [3].

So the floor is: **chroot (or pivot_root) + a new PID namespace + a new mount namespace + a fresh procfs mount.**

## Functional requirements (required)

Each row cites the assignment [1] unless marked *inferred*.

| ID | Requirement | Evidence |
| --- | --- | --- |
| F1 | CLI is `sudo bcdocker run [OPTIONS] <container> <app> [app-args...]`. Options come **before** the container name. | `run --memory=512m bctinysys /bin/bash`; `run tinysys /bin/ls -l -t -r` |
| F2 | `<container>` names a hand-built root filesystem. At least two must exist (`tinysys`, `bctinysys`). | "the name of the container is bctinysys, a different container" |
| F3 | The container's `/` is that rootfs. `ls /` shows only its contents. | `bin etc lib proc usr` |
| F4 | `<app>` and its args are exec'd inside the container, args passed through verbatim. | `/bin/ls -l -t -r` |
| F5 | PID 1 inside the container is **bcdocker itself**. The app is a child of it. | `1 ? S 0:00 bccontainer/bcdocker run bctinysys /bin/bash` |
| F6 | `ps` inside the container sees only container processes. Requires procfs mounted at `/proc` from inside the new PID namespace [3]. | `ps axf` output; `proc` owned by `0 0` in `ls -l` |
| F7 | Interactive apps work on the caller's terminal. `exit` in the app returns to the host shell. | `bash-5.0# exit` then `$` |
| F8 | Containers share the host kernel and run Linux applications. | "share the same underlying operating system kernel"; "for running Linux applications" |
| F9 | Runs as root via `sudo`. Rootless operation is not required. | every example uses `sudo` |

*Inferred* (not stated, but needed for F5–F7 to behave):

- I1. PID 1 must reap zombies and wait for the app. When PID 1 exits, the kernel SIGKILLs the rest of the namespace [3].
- I2. bcdocker should exit with the app's exit status. The assignment is silent; Docker does this.
- I3. The `/proc` mount must not leak to the host. That is why the mount namespace (`CLONE_NEWNS`) is needed, with
  propagation set to private.
- I4. In the examples the app is PID 14, not 2 [1]. My reading: the instructor's tool spent PIDs 2–13 on helper
  processes. It is an artifact, not a requirement.

## Rootfs construction (required, manual)

- R1. Build each tiny system **by hand**, not with Docker or debootstrap: "we will not automate the process; rather,
  we shall manually create application containers" [1].
- R2. Follow the Filesystem Hierarchy Standard [1] (Rankin, Linux Journal, 2019).
- R3. Contents implied by the examples: `bash`, `ls`, `ps`, their shared libraries, the dynamic loader, an empty
  `proc/`. `bin -> /usr/bin` is a symlink [1], which matches Debian's merged-`/usr` layout.
- R4. Files owned by uid 1000 in the example [1], so the rootfs is built as a normal user. Only `run` needs root.
- R5. The process must be documented in the report.

## Deliverables (required)

| ID | Item | Source |
| --- | --- | --- |
| D1 | `README.md` at repo top: student info, description, layout | [1] |
| D2 | `.gitignore` at repo top | [1] |
| D3 | `src/` for source, `doc/` for slides | [1] |
| D4 | One commit per feature. A single "initial commit" is graded incomplete. | [1] |
| D5 | Every AI-assisted commit carries a `Co-authored-by:` trailer naming the tool, e.g. `Co-authored-by: Claude Code <noreply@anthropic.com>` | [1] |
| D6 | Report on ACM or IEEE conference template: design, container creation process, lessons learned, proper citations | [1] |
| D7 | 10-minute talk (7 + 3 Q&A) with slides and a live demo | [1] |

Note on D3: a Cargo crate at the repo root puts `Cargo.toml` beside `src/`, which fits. `doc/` is singular. Do not
also create `docs/`.

## Optional requirements

| ID | Flag | Mechanism | Source |
| --- | --- | --- | --- |
| O1 | `--memory=512m` | cgroup memory controller (`memory.max` on v2) | [1] |
| O2 | `--pids-limit=20` | cgroup pids controller (`pids.max` on v2) | [1] |
| O3 | networking: `lo` + veth (`bcvirt1`), `192.168.57.2/24`, outbound ping | new net namespace, veth pair, NAT on host | [1] |

O3 implies `ip` and `ping` in the rootfs, plus DNS config (`/etc/resolv.conf`) for `ping www.google.com`.

## Platform analysis

| Platform | Role | Can it meet F5, F6, F8? |
| --- | --- | --- |
| Debian native | host + target | Yes. Full namespaces and cgroups. This is the reference platform. |
| bookworm-slim in Docker on macOS | target | Yes, with flags. The kernel is the Docker Desktop Linux VM. Docker's default seccomp profile gates namespace-creating `clone`/`unshare` behind `CAP_SYS_ADMIN` [4], and `mount` needs `SYS_ADMIN` or `--privileged` [5]. Run with `--privileged`. For O1/O2, nested cgroup v2 needs a writable cgroupfs and the process moved out of the container's root cgroup first; Docker's own `dind` script does exactly this [6]. |
| macOS native | host + target | **No.** Darwin has no namespace support [7], no procfs, and runs Mach-O, not Linux ELF. `chroot(2)` exists, so F3/F4 alone are possible, but F5, F6 and F8 are not. |

bookworm-slim ships without `procps`, so `ps` must be `apt install`ed in the outer container before it can be
copied into a tiny rootfs. *Unverified; check before relying on it.*

## Implementation notes (Rust)

- `nix` provides `unshare`, `fork`, `chroot`, `pivot_root`, `mount`, `sethostname`, `execvp`, `waitpid` [8]. Gate the
  Linux-only module behind `#[cfg(target_os = "linux")]`.
- Sequence: `unshare(NEWPID|NEWNS|NEWUTS)` → `fork` (child is PID 1 [3]) → make `/` private → `chroot`/`pivot_root`
  into rootfs → `mount proc` → `fork`+`exec` app → PID 1 waits and reaps.
- `unshare(CLONE_NEWPID)` does not move the caller; only its next child lands in the new namespace [3]. Easy to get
  wrong in the first commit.
- Prefer `pivot_root` over `chroot` for the report's "lessons learned": `chroot` is escapable via open file
  descriptors and the unchanged cwd [2].

## Open questions

1. **What does "macOS native target" mean?** Build-only host, degraded chroot-only mode, or delegate into a Linux VM?
   (Most blocking. Decides the crate structure.)
2. Where do named rootfs directories live? `./<name>`, `/var/lib/bcdocker/<name>`, or a `--root` flag?
3. Is this folder the submission repo, or a mirror of it? The GitHub Classroom repo is the graded artifact [1].
4. Which optional tasks are in scope?
5. Commit trailer: the assignment's example is `Co-authored-by: Claude Code <noreply@anthropic.com>` [1]. Use that
   form in the submission repo.

## Sources

- [1] H. Chen. "Project 2: Application Container." CISC 7310X, Fall 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/assignment/bccontainer
- [2] Linux man-pages. "chroot(2)." [Online]. Available: https://man7.org/linux/man-pages/man2/chroot.2.html
- [3] Linux man-pages. "pid_namespaces(7)." [Online]. Available: https://man7.org/linux/man-pages/man7/pid_namespaces.7.html
- [4] Docker. "Seccomp security profiles for Docker." [Online]. Available: https://docs.docker.com/engine/security/seccomp/
- [5] moby/moby. "Issue #38075." [Online]. Available: https://github.com/moby/moby/issues/38075
- [6] moby/moby. "hack/dind." [Online]. Available: https://fuchsia.googlesource.com/third_party/github.com/moby/moby/+/cbd94183abd05880d293f1235707209d7fe593b8/hack/dind
- [7] Kitemetric. "Containerization on macOS vs. Linux." [Online]. Available: https://kitemetric.com/blogs/containerization-on-macos-vs-linux-a-security-showdown
- [8] docs.rs. "nix::sched." [Online]. Available: https://docs.rs/nix/latest/nix/sched/
