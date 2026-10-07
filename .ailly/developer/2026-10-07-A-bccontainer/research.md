# BCDocker (CISC 7310X Project 2): Research

*Draft 2026-10-07*

## Topic and Intent

The request began as:

> begin https://huichen-cs.github.io/course/CISC7310X/26FA/assignment/bccontainer and I'll be honest I'm not sure where to go beyond that? I can't tell if the assignment just wants basically a chroot jail? It seems so, so for research let's start going in that direction. Language is rust, working folder is /pages/course/cisc_7310/bccontainer, host platforms are MacOS native & Debian native, and target platforms are those and also bookworm-slim running itself in docker on Mac. The PID requirement is confusing, I'm not sure if it wants an entirely isolated process space as well? So build an isolated filesystem with /bin, parts of /etc, ??? And then start a new PID1 inside that environment?
>
> Focus on requirement gathering for now, we can go beyond this chroot idea later.

It was then restated and narrowed:

> Language is rust, working folder is /pages/course/cisc_7310/bccontainer, host platforms are MacOS native & Debian native, and target platforms are bookworm-slim VM and bookworm-slim in docker on Mac.
>
> The core requirements are safe rust, clone and chroot sys calls, and preparing an appropriate chroot. During research and design, discuss clone vs clone3, flag choices, io redirection, etc. Probably start with CLONE_IO? Don't start with network at this time.

In plain terms: pin down what CISC 7310X Project 2 ("BCDocker") requires, then settle the technical choices that follow from "safe Rust, `clone`, `chroot`, a prepared root filesystem": which `clone` variant and flags, how stdio is wired, how the rootfs is built, and which platforms can run the result. The tool is written in Rust in `pages/course/cisc_7310/bccontainer`. Networking is out of scope for now.

## Search/Expand

### What the assignment requires

It is not a chroot jail alone. The assignment says "Process IDs start from 1 in the container" [1], and the lecture sets the minimum:

> "Use clone() to create a child in at least two new namespaces (e.g., PID and UTS). Demonstrate that the child sees a different view from the parent: the child is PID 1 in its own PID namespace; the child can set its own hostname without affecting the parent; (optional) the child sees its own /proc. Explain, in writing, what each flag does and what would happen without it." [2]

The same slides call for a separate filesystem root: "chroot() or pivot_root() gives the child its own filesystem root" [2]. The minimum container is therefore a namespaced process (PID, UTS, and mount namespaces) that is chrooted into a hand-built root filesystem. The instructor's tutorial code does exactly this: `clone(…, CLONE_NEWNS | CLONE_NEWPID | CLONE_NEWUTS | SIGCHLD)`, then `sethostname`, `chroot`, `chdir("/")`, a `proc` mount, and the application [3]. The PID 1 comes from the PID namespace, not from the chroot.

The sample output shows the intended process shape [1]:

```
$ sudo bccontainer/bcdocker run bctinysys /bin/ps axf
  PID TTY      STAT   TIME COMMAND
   1 ?        S+     0:00 bccontainer/bcdocker run bctinysys /bin/ps axf
  14 ?        R+     0:00 /bin/ps axf
```

PID 1 still carries the launcher's argv, and the application is its child. The tutorial's final run has the same shape (`1 bcdocker`, `2 bash`, `3 ps`) [3]. The launcher's child is a small init that sets up the container, starts the application, and waits for it. `ps` lists only the container's processes when a fresh procfs is mounted at the container's `/proc` [8].

### Requirements

E marks a requirement stated in a course source; I marks one inferred.

**Behavior**

1. **E.** A CLI that "mirrors … Docker" for a small subset: `bcdocker run <container> <application> [args…]` [1]. The tutorial requires `argc >= 4` and prints usage otherwise [3].
2. **E.** It runs as root through `sudo` in every example [1]. **I.** Rootless operation and user namespaces are not required.
3. **E.** It launches a Linux application container; containers "share the same underlying operating system kernel" [1]. Application arguments pass through (`/bin/ls -l -t -r`) [1].
4. **E.** At least two distinct containers appear in the samples (`tinysys`, `bctinysys`) [1]. **I.** The container name resolves to a rootfs directory; the tutorial passes a path and calls `chroot(argv[2])` [3].
5. **E.** The container sees an isolated filesystem: `ls /` shows only `bin etc lib proc usr` [1]; "chroot() or pivot_root()" [2].
6. **E.** Process IDs start from 1 [1], and the child is PID 1 in its own PID namespace [2]. **I.** The launcher's child is PID 1 and the application is its child (sample output above).
7. **E.** `clone()` creates the child in "at least two new namespaces (e.g., PID and UTS)" [2]. **I.** Mount namespace too: the tutorial uses it [3], and remounting `/proc` without it would alter the host's mounts.
8. **E.** The child sets its own hostname without affecting the host [2]; the tutorial uses `bcdocker` [3].
9. **E in [1], optional in [2].** `ps` works inside, so procfs is mounted at the container's `/proc`.
10. **E.** An interactive shell works and `exit` returns to the host prompt [1]. **I.** The launcher waits for the container; the exit status is unspecified.

**Rootfs**

11. **E.** "we will not automate the process; rather, we shall manually create application containers," starting from the Filesystem Hierarchy Standard [1]. The published page breaks off mid-list here, so the step list is missing.
12. **I.** The samples and tutorial imply `bin` (or `bin -> usr/bin`), `usr/bin`, `lib` with `ldd`-resolved libraries and the dynamic loader, `etc`, and an empty `proc`; `bash`, `ls`, and `ps` are the demonstrated applications [1][3].

**Deliverables**

13. **E.** A GitHub Classroom repository with `README.md`, `.gitignore`, `src/` for code, and `doc/` for slides [1].
14. **E.** Commit each completed feature separately; a single initial commit "will be treated as incomplete". AI use is disclosed by a `Co-authored-by` trailer on each assisted commit [1][5].
15. **E.** An ACM or IEEE template report covering the tool's design, the process of building a Linux container for an application, and lessons learned, with citations [1]. **E.** The lecture asks for a written explanation of "what each flag does and what would happen without it" [2]. **I.** The report lives in `doc/`; the page names no location.
16. **E.** A 10-minute in-class presentation (7 minutes talk, 3 minutes Q&A) that includes a demo of the program's features [1].
17. **E.** Assigned Oct 7, 2026; due **Oct 14, 2026**, dates "subject to change" [4]. Late work loses one letter grade per day and scores 0 at five or more days; projects, presentations, and papers together are 40% of the course grade [5]. No per-project rubric is published.
18. **E.** Language: "C or C++ or a language of your choice" [1]. The page names no implementation constraints on Rust, `unsafe`, or `chroot`, and the lecture says "use clone()" [2]. "Safe Rust" comes from your brief.

**Optional and deferred.** `--memory=512m`, `--pids-limit=20`, and networking (network namespace, veth pair, NAT) [1]. The lecture lists "image pulling, overlay filesystems, networking, resource limits" as "Not required for the minimum" [2].

### clone versus clone3, and the flag set

- **Use `clone`, not `clone3`.** Both create the same namespaces from the same flags. `clone3` (Linux 5.3) takes a `struct clone_args` with 64-bit flags, an explicit stack size, `set_tid`, `CLONE_PIDFD`, and `CLONE_INTO_CGROUP` [6]. None of those is needed for the minimum. glibc has no `clone3` wrapper, so a caller must use `syscall(2)` [6], and no Rust crate surveyed wraps it safely (the `clone3` crate's `call()` is `unsafe`). `clone` has a glibc wrapper and a `nix` binding. Bookworm's kernel (6.1) supports `clone3`, so availability is not the constraint. Docker's default seccomp profile returns `ENOSYS` for `clone3` only to containers without `CAP_SYS_ADMIN` [12], so it does not bear on the privileged targets. Reconsider `clone3` when cgroup limits arrive: `CLONE_INTO_CGROUP` places the child in a cgroup at creation.
- **`CLONE_IO` is not the place to start.** The man page says the child "shares an I/O context with the calling process", where the I/O context is "the I/O scope of the disk scheduler" [7]. It tunes block-layer scheduling for threads doing I/O for one process. It isolates nothing and does not redirect stdin, stdout, or stderr. If the intent was "start with the I/O plumbing", the first milestone is a child whose stdio reaches the terminal (see I/O redirection).
- **Starting set:** `CLONE_NEWPID | CLONE_NEWNS | CLONE_NEWUTS | CLONE_NEWIPC`, with `SIGCHLD` as the exit signal so the parent can `waitpid` [7]. Creating these namespaces requires `CAP_SYS_ADMIN`; `CLONE_NEWUSER` is the exception [6]. Deferred: `CLONE_NEWNET` (requested), `CLONE_NEWCGROUP`, `CLONE_NEWUSER`. `CLONE_FS` is rejected with `CLONE_NEWNS` (`EINVAL`), and with `CLONE_NEWUSER`; `CLONE_NEWUSER` and `CLONE_NEWPID` are also rejected with `CLONE_THREAD` or `CLONE_PARENT` [7].
- **Flags left off, and why** [7]. The child is a separate process, not a thread, so the sharing flags stay unset:

  | Flag | Effect if set | Why it stays off |
  |---|---|---|
  | `CLONE_VM` | Child shares the parent's memory | The child's setup code would write into the parent's memory before `exec` |
  | `CLONE_VFORK` | Parent suspends until the child execs or exits | The child outlives `exec` as the container's init, and the parent must be free to forward signals meanwhile; it also requires care with `CLONE_VM` |
  | `CLONE_FILES` | Shared descriptor table | The child's `close`/`CLOEXEC` hygiene would change the parent's descriptors |
  | `CLONE_FS` | Shared root, cwd, and umask | Rejected with `CLONE_NEWNS`, which is in the starting set; it would also let the child's `chroot` change the parent's root |
  | `CLONE_SIGHAND`, `CLONE_THREAD`, `CLONE_PARENT` | Shared signal handlers (requires `CLONE_VM`); thread semantics; sibling parentage | `CLONE_THREAD` and `CLONE_PARENT` are rejected with `CLONE_NEWPID`; the parent must stay the child's parent to `waitpid` it |
  | `CLONE_PIDFD` | Returns a pidfd for the child | Not needed; `waitpid` suffices |
  | `CLONE_IO` | Shared disk I/O context | No isolation or stdio effect, as above |

- **PID 1 duties.** The first process in a PID namespace is init: it receives only signals it has handlers for (SIGKILL and SIGSTOP from an ancestor namespace still work), orphans reparent to it, and when it exits the kernel SIGKILLs the whole namespace [8].

### Child setup order

```
parent: clone(child, stack, CLONE_NEWNS|CLONE_NEWPID|CLONE_NEWUTS|CLONE_NEWIPC|SIGCHLD)
child:  mount(NULL, "/", NULL, MS_REC|MS_PRIVATE, NULL)      // stop mount propagation to the host
        sethostname(name)
        mount(rootfs, rootfs, NULL, MS_BIND|MS_REC, NULL)     // a mount point; required by pivot_root, harmless for chroot
        mount("proc", rootfs/proc, "proc", MS_NOSUID|MS_NOEXEC|MS_NODEV, NULL)
        chdir(rootfs); chroot("."); chdir("/")
        execve(app, argv, envp)                               // or fork+exec and wait, to match the sample
parent: waitpid(child) -> exit status
```

Before `execve`, the child must also close every descriptor above 2 (or have opened them with `O_CLOEXEC`). A directory descriptor opened on the host before the `chroot` survives it, and `fchdir` on that descriptor returns the child to the host tree [19].

The `MS_PRIVATE` step matters: on systemd hosts `/` is a shared mount, and without it the child's `/proc` mount leaks back to the host [20]. Plain `chroot` is not a security boundary: it does not change the working directory, and the man page shows the escape `mkdir foo; chroot foo; cd ..` [19]. `pivot_root(".", ".")` followed by `umount2(".", MNT_DETACH)` detaches the old tree and closes that escape; it requires the new root to be a mount point [18]. The assignment asks only for chroot, so `pivot_root` is an optional hardening step.

### Safe Rust

Every direct Rust binding of `clone` and `fork` (`libc`, `nix`, `rustix`, `clone3`) is `unsafe`, which puts "safe Rust" and "clone" in tension. Verified against current crate sources (nix 0.31.3, rustix 1.1.5) and std docs [13][14][15]:

| Operation | nix 0.31.3 | rustix 1.1.5 | std |
|---|---|---|---|
| `clone` | `sched::clone` is `unsafe fn` (stack overflow and post-fork constraints) | none public | none |
| `fork` | `unistd::fork` is `unsafe fn` | `kernel_fork` is unsafe and hidden | none |
| `unshare` | `sched::unshare` is safe | deprecated since 1.1.0; `unshare_unsafe` is `unsafe` because `CLONE_FILES` can split fd tables between threads | none |
| `chroot` | `unistd::chroot` safe | `process::chroot` safe | `std::os::unix::fs::chroot` safe, stable since 1.56 |
| `pivot_root`, `mount`, `sethostname`, `waitpid` | safe | safe | none (except `Child::wait`) |
| `execve` | safe | unsafe | `CommandExt::exec` safe |

`CommandExt::pre_exec` is `unsafe`, and `CommandExt::chroot` is nightly only. Other crates: `libc` is entirely unsafe; `clone3` 0.2.3 has an `unsafe` `call()`; `unshare` 0.7.0 offers a safe `Command`-like builder with namespaces and chroot but was last released in 2021 and pins nix 0.20 [16]; youki's `libcontainer` keeps one audited `unsafe` clone module and uses safe nix wrappers everywhere else [17].

Two ways to meet "safe Rust":

- **Option A, unshare plus re-exec (no `unsafe` in our crate).**
  1. The parent calls `unshare(NEWPID|NEWNS|NEWUTS|NEWIPC)`.
  2. It spawns its own binary (`/proc/self/exe __init …`) with `std::process::Command`. That child is PID 1.
  3. The child makes `/` private, sets the hostname, mounts proc, chroots, changes to `/`, and execs or forks the application.
  4. The whole crate can use `#![forbid(unsafe_code)]`. In edition 2024, `std::env::set_var` is unsafe, so the child's environment is set with `Command::env`.
- **Option B, literal `clone` (one audited `unsafe` module).** `nix::sched::clone` behind `#![deny(unsafe_code)]` and one `#[allow(unsafe_code)]` module of about 30 lines with a `SAFETY` comment (single-threaded caller, heap-allocated stack, child closure that only calls nix syscall wrappers before `execve`), or a separate `-sys` crate. This is youki's design [17].

Option A differs from a raw `clone` in ways the report must explain [8][9]:

1. The caller is not moved into the new PID namespace; only its first child is.
2. The mount and UTS namespaces do move the caller, so the parent's own mounts and hostname changes affect the container.
3. After `unshare(CLONE_NEWPID)` the parent cannot create threads (`clone` returns `EINVAL` for `CLONE_THREAD`) [7].
4. Once the first child exits, later forks fail with `ENOMEM`, so each parent process hosts one container [8].
5. `/proc` shows the PID namespace of whoever mounts it, so the re-exec'd child must mount it [8].
6. std's `Command` spawns through `posix_spawn`, `pidfd_spawnp`, or `fork` internally [33], so a `clone` still happens, just not by name in our code.

### I/O redirection

- **Inherit stdio (the minimum).** The child keeps the parent's descriptors 0, 1, and 2 across `clone` and `exec`; runc calls this the pass-through mode, `terminal: false` [22]. It is enough for `bcdocker run tinysys /bin/bash` from an interactive shell, and it makes host-side redirection work unchanged: `bcdocker run c /bin/ls > out.txt` and `cat f | bcdocker run c /bin/wc` write to and read from the host's descriptors. Bash may print a job-control warning in this mode.
- **Descriptor hygiene.** Inheritance is not limited to 0 to 2: every open descriptor crosses `exec`. Close or `CLOEXEC`-mark everything above 2 before entering the container, or a host directory descriptor defeats the chroot (see the setup order).
- **Pipes.** Needed only to capture or log output; the runtime must pump them and the application loses terminal detection.
- **Pseudo-terminal (stretch).** Allocate a pty in the container's devpts, `setsid()` [34], `ioctl(TIOCSCTTY)`, `dup2` the slave onto 0, 1, 2, and proxy bytes between the parent's raw-mode terminal and the master [22].
- **Exit status.** The parent waits and returns the child's exit code, or 128 plus the signal number if the child was killed (the usual shell convention).
- **Signals.** A terminal sends Ctrl-C to the whole foreground process group, which includes the parent and the container's processes, so the parent decides whether to ignore SIGINT and SIGTERM or forward them with `kill`. Inside the container, PID 1 drops signals it has no handler for (see PID 1 duties), so a launcher-as-init that forwards signals to the application needs handlers of its own.

### Rootfs preparation

| Option | How | Notes |
|---|---|---|
| **Extract `debian:bookworm-slim`** (recommended) | `docker create` + `docker export` [35], or `crane export --platform linux/arm64 debian:bookworm-slim` (no daemon; works on macOS) [24] | About 28 MB compressed per architecture; same userland as the run target; pin by digest for reproducibility [23] |
| `debootstrap --variant=minbase bookworm` | Linux and root required [36] | Larger than slim; not reproducible by default; cross-architecture needs `--foreign`/`--second-stage` or qemu |
| `mmdebstrap` | `--mode=unshare` runs without root [25] | Supports `SOURCE_DATE_EPOCH`; better than debootstrap if building from packages |
| Static BusyBox | Copy `busybox`, run `busybox --install -s` | Has no `/bin/bash`, which the assignment examples use [1]; suits a second demo container only |

The rootfs must match the VM's architecture (Apple silicon runs arm64 Linux). Keep `rootfs/` in `.gitignore` and ship a script that builds it, so each host builds its own. The extracted image already holds the FHS skeleton (`bin sbin lib usr etc dev proc sys tmp var run root home`); bookworm uses merged `/usr`, so `/bin` and `/lib` are symlinks.

For `/dev`, mount a tmpfs and `mknod` null, zero, full, random, urandom, and tty, which OCI requires [21]. Do not bind the whole host `/dev`, and avoid `devtmpfs`, which exposes every host device. For `/etc`, the image already ships `passwd` and `group`; write `/etc/hostname` to match `sethostname`. `resolv.conf` is moot without networking.

### Platforms

The two hosts are macOS native and Debian native. The two run targets are a `bookworm-slim` VM and `bookworm-slim` in Docker on a Mac. Each environment can do the following:

| Environment | Role | Namespaces, chroot, Linux binaries | Notes |
|---|---|---|---|
| **macOS native** | Build and edit host | None: Darwin has no PID, UTS, or mount namespaces and cannot execute Linux ELF binaries | Gate Linux code with `cfg(target_os = "linux")`, declare `nix` under `[target.'cfg(target_os = "linux")'.dependencies]`, and have `bcdocker run` exit with a clear message on Darwin |
| **Debian native** | Build host; also a run target when used as root | All available with root | Not named as a target in the request, but nothing prevents running there |
| **`bookworm-slim` VM** | Run target | All available with root | What the VM is, and which host runs it, is unspecified (see decision 7) |
| **`bookworm-slim` in Docker on Mac** | Run target | Runs on Docker Desktop's Linux VM kernel; needs elevated privileges (below) | Rootfs must be arm64 on Apple silicon |

**Docker privileges.** The default seccomp profile denies namespace `clone`, `unshare`, and `mount` unless the container has `CAP_SYS_ADMIN`, and denies `pivot_root` as a privileged operation [11]. The profile adjusts to the capabilities granted, and `CAP_SYS_CHROOT` is a default capability, so `chroot` alone works unprivileged [10]. Docker's default AppArmor profile denies `mount` where AppArmor is enforced [26]; whether Docker Desktop's VM enforces it is unknown. `--privileged` grants all capabilities and reconfigures AppArmor [10], so it covers both. Rootless Docker and Enhanced Container Isolation run containers in user namespaces, where the kernel refuses a fresh `/proc` mount that would reveal too much [28]; the mount is expected to fail there, but this was not tested.

**Build and run paths.**
- *Debian native:* `cargo build`, the rootfs script, then `sudo ./target/debug/bcdocker run …`.
- *macOS to Docker:* bind-mount the repo into a privileged `rust:1-bookworm` container, then build and run inside it. This avoids cross-compiling.
- *macOS to VM:* cross-compile (`cargo check --target aarch64-unknown-linux-gnu` type-checks without a linker; `cargo zigbuild` or the musl target produces a binary [27]), or build inside the VM through a shared directory in a Lima or OrbStack VM. Neither was tested.
- A Darwin chroot jail is not a fallback: system libraries live only in the dyld shared cache since Big Sur, and it could not meet the PID or hostname requirements [29][30].

## Libraries & Skills

Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: none. No published agentic skill ships with `nix`, `rustix`, `libc`, or std, and none was found in this harness. 

- **`nix` 0.31.3** [13]: `sched::{clone, unshare, CloneFlags}` (feature `sched`), `mount::{mount, MsFlags}` (`mount`), `unistd::{chroot, chdir, pivot_root, execve, sethostname}` (`fs`, `process`, `hostname`), `sys::wait::waitpid` (`process`). `clone` is `unsafe` and takes a caller-supplied stack slice; nix handles stack direction. Sched, mount, and `pivot_root` are Linux-only.
- **`rustix` 1.1.5** [14] is the alternative to nix for everything except `clone`, which it lacks.
- **Closest worked examples:** Litchi Pi's "Writing a container in Rust" series (crabcan, using nix) [31]; Liz Rice's containers-from-scratch in Go, with the same clone, chroot, and proc-mount shape as the tutorial [32]; youki for reference only [17].
- **Local convention:** the sibling `uefi_boot` project uses edition 2021, few dependencies, `panic = "abort"`, and a Makefile whose `install`, `build`, and `run` targets branch on `uname -s` for Darwin versus Debian. macOS is a dev host there too. See `research/codebase.md`.

## Falsification/Refine

**"A chroot jail satisfies the assignment."** Refuted by the PID requirement [1], the lecture's "at least two new namespaces" [2], and the tutorial's flags [3]. A plain chroot leaves the process in the host PID namespace, so `ps` shows host PIDs, and `sethostname` renames the host.

**"Start with `CLONE_IO`."** Refuted by the man page [7]: it concerns disk scheduling, not isolation or stdio.

**"`clone3` is the modern choice."** True of the kernel interface, but it buys nothing the minimum needs, has no glibc wrapper [6], and has no safe Rust binding. Docker's `ENOSYS` rule for `clone3` does not apply to the privileged targets [12].

**"All four environments can run the container."** Refuted for macOS native, as the platform table shows.

**"Safe Rust and `clone` are compatible."** Only partly. Every direct binding of `clone` is `unsafe` [13][14]. The `unshare` crate hides the call behind a safe API but is unmaintained [16]. Option B satisfies both words of the requirement under the reading "safe Rust means memory-safe Rust with unsafe confined to one audited module". Option A satisfies "safe" under the stricter reading "no `unsafe` anywhere", reaches the same kernel behavior through `unshare` plus a spawn, and never calls `clone` by name.

**Size.** One feature-sized project: a small binary (a few hundred lines), a rootfs build script and notes, a report, and slides. Off-the-shelf tools (`unshare(1)` with `chroot(8)`, Docker, runc, youki) already do this, but the assignment is to build it, so they serve as references only.

**Smallest version that meets the intent:** `bcdocker run <rootfs-dir> <cmd> [args…]` creates new PID, UTS, mount, and IPC namespaces, sets the hostname, makes mounts private, mounts `/proc`, chroots, and runs the application as a child of PID 1, waiting for it and returning its exit status. It ships with a rootfs build script producing at least two containers (`bookworm-slim` extract plus a smaller second one), verified on a Debian host or VM and in privileged `bookworm-slim` on the Mac, with the report and slides.

**Not yet verified.** `pivot_root` and the `/proc` mount have not been run in Docker Desktop, nor has the rootless and Enhanced Container Isolation failure mode. Whether Docker Desktop's VM enforces AppArmor is unknown (moot under `--privileged`). Whether `--privileged` also disables the default seccomp profile is not stated on the Docker pages read [10][11]. The instructor video may expect a hand-copied rootfs built from `ldd` output rather than an image extract. The `pivot_root` and `/proc` checks run on a Linux host with Docker; the Docker Desktop checks need the Mac.

## Scope

**In scope for design:**
- The `run` subcommand and the launcher: new PID, UTS, mount, and IPC namespaces, hostname, private mounts, `/proc`, chroot, and PID 1 behavior (requirements 1 to 10).
- The choice between Option A and Option B, the full `clone` flag set with a reason for each flag left off, and the report's explanation of what each flag does.
- A documented, scripted rootfs build per host architecture, for at least two containers (requirements 11 and 12).
- stdio inheritance, descriptor hygiene, host-side redirection, exit-status propagation, and signal handling in the launcher.
- The platform strategy: the `bookworm-slim` VM and privileged Docker on Mac as run targets, Debian native as build and run host, macOS as the build host with a clean unsupported-platform exit, and the build-and-run path for each pairing.
- Repository and deliverable layout, per-feature commits with AI trailers, the report, and the slides (requirements 13 to 16).

**Out of scope for now:** networking, `--memory` and `--pids-limit` cgroup limits, user, cgroup, and time namespaces, image pulling, overlayfs, OCI compatibility, rootless mode, and the pty stretch goal.

## Resolved Decisions

**Settled by research**
- The assignment needs PID, UTS, and mount namespaces plus chroot and a fresh `/proc`; chroot alone does not meet it [1][2][3].
- Prefer `clone` over `clone3`; `CLONE_IO` does not belong in the starting set; start with the namespace flags above.
- The Docker-on-Mac demo needs elevated privileges, and `--privileged` is the setting that covers both capabilities and AppArmor [10][26].
- macOS native cannot host the container.
- Rust is permitted [1]; the due date is Oct 14, 2026 [4].

**For you to decide**, most blocking first:

1. **What "safe Rust" means.** You listed "safe rust" and "clone and chroot sys calls" as core requirements. Option B (literal `clone` behind one audited `unsafe` module) meets both if "safe" means memory-safe Rust with unsafe confined and justified. Option A (`unshare` plus re-exec, no `unsafe` at all) meets "safe" in the strictest sense but never calls `clone(2)`, so the clone and flag discussion would describe a call the code does not make, and `CLONE_IO` could not be passed. I recommend B. Choose A if "safe" means no `unsafe` anywhere.
2. **What "flag choices" and `CLONE_IO` were for.** Did "flag choices" mean the full `clone` flag word (covered above, with a reason for each flag left off) or only the namespaces? Was "start with `CLONE_IO`" meant as "start with the I/O plumbing", or do you want the disk-scheduler behavior of `CLONE_IO` explained in the report?
3. **Repository mapping.** The submission is a GitHub Classroom repo with `README.md`, `.gitignore`, `src/`, and `doc/` at its root [1]. Will `pages/course/cisc_7310/bccontainer` be that repo's root, or a mirror? This decides whether the Cargo crate sits at the folder root and how commit history reaches the classroom repo.
4. **PID 1 shape.** Match the sample (the launcher's child is PID 1 and forks, waits for, and reaps the application) or exec the application directly as PID 1. I recommend matching the sample.
5. **Rootfs.** Is a `docker export` or `crane export` of `bookworm-slim` acceptable, given the assignment's "manually create" wording and the tutorial's `ldd`-copy method [1][3]? Which applications beyond `bash`, `ls`, and `ps`? What is the second container?
6. **macOS role.** Is build-host-only, with a clear error from `bcdocker run` on Darwin, acceptable? A chroot-only degraded mode there would not meet the spec.
7. **Hosts and the VM.** What is the "bookworm-slim VM" (a Debian install, or an image under Lima, UTM, or QEMU), which host runs it, and is Debian native also a machine you will run containers on directly? Is the Debian machine amd64 or arm64? Apple silicon Docker is arm64, and a mismatch means the rootfs is built per host.
8. **Missing course text.** The assignment page is truncated where the "Creating a Tiny Linux System" steps belong, and the demo is to include "the discussion about the questions in this assignment" [1], but no question list is published. Ask the instructor, or plan around the lecture's "what each flag does and what would happen without it" [2]?
9. **Report and slides.** Confirm the report goes in `doc/` beside the slides, and whether design should plan them or only the code.
10. **Commit history.** The repository's history starts now and is graded. Should the first plan step set up the classroom repository, `README.md`, and `.gitignore` before any feature work?
11. **Namespace set.** Does PID, UTS, mount, and IPC suit you, or do you want the minimum (PID, UTS, mount)? IPC costs one flag and adds one more behavior to explain.

## Sources

[1] H. Chen, "Project 2: Application Container," CISC 7310X Operating Systems I, CUNY Brooklyn College, Fall 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/assignment/bccontainer (accessed Oct. 7, 2026).
[2] H. Chen, "Process Abstraction and Isolation in Linux," lecture slides, CISC 7310X, Sep. 30, 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/lecture/processisolation.pdf
[3] H. Chen, "A Tutorial for BC Docker Project (OS Application Container)," video, 2023. [Online]. Available: http://www.sci.brooklyn.cuny.edu/~chen/uploads/course/CISC7310X/video/bcdocker.html (frames at 57:00, 1:17:00, 1:32:00, 1:47:00 in `research/video-frames/`).
[4] H. Chen, "Assignments," CISC 7310X, Fall 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/assignments/
[5] H. Chen, "Syllabus," CISC 7310X, Fall 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/syllabus/
[6] M. Kerrisk et al., "clone3(2)," Debian manpages, unstable. [Online]. Available: https://manpages.debian.org/unstable/manpages-dev/clone3.2.en.html
[7] M. Kerrisk, "clone(2)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man2/clone.2.html
[8] M. Kerrisk, "pid_namespaces(7)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man7/pid_namespaces.7.html
[9] M. Kerrisk, "unshare(2)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man2/unshare.2.html
[10] Docker Inc., "Running containers." [Online]. Available: https://docs.docker.com/engine/containers/run/
[11] Docker Inc., "Seccomp security profiles for Docker." [Online]. Available: https://docs.docker.com/engine/security/seccomp/
[12] Moby, "seccomp: add support for clone3 syscall in default policy." [Online]. Available: https://git.causa-arcana.com/kotovalexarian-likes-github/moby--moby/commit/9f6b562dd12ef7b1f9e2f8e6f2ab6477790a6594
[13] nix-rust, "nix 0.31.3," docs.rs. [Online]. Available: https://docs.rs/nix/0.31.3/nix/
[14] bytecodealliance, "rustix 1.1.5," docs.rs. [Online]. Available: https://docs.rs/rustix/1.1.5/rustix/
[15] The Rust Project, "std::os::unix::process::CommandExt" and "std::os::unix::fs::chroot." [Online]. Available: https://doc.rust-lang.org/std/os/unix/process/trait.CommandExt.html
[16] P. Colomiets, "unshare 0.7.0," docs.rs. [Online]. Available: https://docs.rs/unshare/0.7.0/unshare/
[17] youki-dev, "youki" and "libcontainer 0.7.0." [Online]. Available: https://github.com/youki-dev/youki
[18] M. Kerrisk, "pivot_root(2)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man2/pivot_root.2.html
[19] M. Kerrisk, "chroot(2)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man2/chroot.2.html
[20] M. Kerrisk, "mount_namespaces(7)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man7/mount_namespaces.7.html
[21] Open Container Initiative, "Linux Container Configuration," runtime-spec. [Online]. Available: https://github.com/opencontainers/runtime-spec/blob/main/config-linux.md
[22] Open Container Initiative, "Terminals and Standard IO," runc docs. [Online]. Available: https://github.com/opencontainers/runc/blob/main/docs/terminals.md
[23] Docker Library, "repo-info: debian:bookworm-slim." [Online]. Available: https://github.com/docker-library/repo-info/blob/master/repos/debian/remote/bookworm-slim.md
[24] Google, "crane export," go-containerregistry. [Online]. Available: https://github.com/google/go-containerregistry/blob/main/cmd/crane/doc/crane_export.md
[25] J. Schauer, "mmdebstrap(1)," bookworm manpages. [Online]. Available: https://manpages.debian.org/bookworm/mmdebstrap/mmdebstrap.1.en.html
[26] Moby, "AppArmor docker-default template," moby/profiles. [Online]. Available: https://raw.githubusercontent.com/moby/profiles/main/apparmor/template.go
[27] rust-cross, "cargo-zigbuild." [Online]. Available: https://github.com/rust-cross/cargo-zigbuild
[28] A. Crequy, "[PATCH] namespace.c: Allow some unprivileged proc mounts when not fully visible," LKML, Apr. 2018. [Online]. Available: https://lkml.iu.edu/hypermail/linux/kernel/1804.0/02051.html
[29] Apple, "chroot(2)," macOS System Calls Manual. [Online]. Available: https://keith.github.io/xcode-man-pages/chroot.2.html
[30] Apple Developer Forums, thread 667340 (Big Sur dynamic linker cache), and Apple, "Technical Q&A QA1118." [Online]. Available: https://developer.apple.com/forums/thread/667340
[31] Litchi Pi, "Writing a container in Rust." [Online]. Available: https://litchipi.github.io/series/container_in_rust
[32] L. Rice, "containers-from-scratch." [Online]. Available: https://github.com/lizrice/containers-from-scratch
[33] The Rust Project, "library/std/src/sys/process/unix/unix.rs," rust-lang/rust. [Online]. Available: https://github.com/rust-lang/rust/blob/main/library/std/src/sys/process/unix/unix.rs
[34] M. Kerrisk, "setsid(2)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man2/setsid.2.html
[35] Docker Inc., "docker container export." [Online]. Available: https://docs.docker.com/reference/cli/docker/container/export/
[36] Debian, "debootstrap(8)," bookworm manpages. [Online]. Available: https://manpages.debian.org/bookworm/debootstrap/debootstrap.8.en.html
