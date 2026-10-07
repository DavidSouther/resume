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

In plain terms: establish what the assignment requires of a container runtime, then settle the technical choices for a Rust implementation built on safe Rust, `clone`, `chroot`, and a prepared root filesystem: which `clone` variant and flags, how stdio is wired, how the rootfs is built, and which platforms can run it. Networking is out of scope. Submission logistics (repository, commits, report, slides, deadline) are deferred by the user.

## Search/Expand

### What the assignment requires

It is not a chroot jail alone. The assignment says "Process IDs start from 1 in the container" [1], and the lecture sets the minimum:

> "Use clone() to create a child in at least two new namespaces (e.g., PID and UTS). Demonstrate that the child sees a different view from the parent: the child is PID 1 in its own PID namespace; the child can set its own hostname without affecting the parent; (optional) the child sees its own /proc. Explain, in writing, what each flag does and what would happen without it." [2]

The same slides call for a separate filesystem root: "chroot() or pivot_root() gives the child its own filesystem root" [2]. The minimum container is a namespaced process (PID, UTS, and mount namespaces) chrooted into a prepared root filesystem. The instructor's tutorial code does exactly this: `clone(…, CLONE_NEWNS | CLONE_NEWPID | CLONE_NEWUTS | SIGCHLD)`, then `sethostname`, `chroot`, `chdir("/")`, a `proc` mount, and the application [3]. The PID 1 comes from the PID namespace, not from the chroot.

The sample output shows the process shape [1]:

```
$ sudo bccontainer/bcdocker run bctinysys /bin/ps axf
  PID TTY      STAT   TIME COMMAND
   1 ?        S+     0:00 bccontainer/bcdocker run bctinysys /bin/ps axf
  14 ?        R+     0:00 /bin/ps axf
```

PID 1 still carries the launcher's argv, and the application is its child. The tutorial's final run has the same shape (`1 bcdocker`, `2 bash`, `3 ps`) [3]. `ps` lists only the container's processes when a fresh procfs is mounted at the container's `/proc` [6].

### Requirements

E marks a requirement stated in a course source; I marks one inferred.

1. **E.** A CLI that "mirrors … Docker" for a small subset: `bcdocker run <container> <application> [args…]` [1]. It runs as root through `sudo` in every example [1]. **I.** Rootless operation is not required.
2. **E.** It launches a Linux application container; containers "share the same underlying operating system kernel" [1]. Application arguments pass through (`/bin/ls -l -t -r`) [1].
3. **E.** At least two distinct containers appear in the samples (`tinysys`, `bctinysys`) [1]. **I.** The container name resolves to a rootfs directory; the tutorial passes a path and calls `chroot(argv[2])` [3].
4. **E.** The container sees an isolated filesystem: `ls /` shows only `bin etc lib proc usr` [1]; "chroot() or pivot_root()" [2].
5. **E.** Process IDs start from 1 [1], and the child is PID 1 in its own PID namespace [2]. **I.** The launcher's child is PID 1 and the application is its child (sample output above).
6. **E.** `clone()` creates the child in "at least two new namespaces (e.g., PID and UTS)" [2]. **I.** Mount namespace too: the tutorial uses it [3], and remounting `/proc` without it would alter the host's mounts.
7. **E.** The child sets its own hostname without affecting the host [2]; the tutorial uses `bcdocker` [3].
8. **E in [1], optional in [2].** `ps` works inside, so procfs is mounted at the container's `/proc`.
9. **E.** An interactive shell works and `exit` returns to the host prompt [1]. **I.** The launcher waits for the container; the exit status is unspecified.
10. **E.** Language: "C or C++ or a language of your choice" [1].

Optional and deferred: `--memory=512m`, `--pids-limit=20`, and networking [1]. The lecture lists "image pulling, overlay filesystems, networking, resource limits" as "Not required for the minimum" [2].

### clone versus clone3, and the flag set

- **Use `clone`, not `clone3`.** Both create the same namespaces from the same flags. `clone3` (Linux 5.3) takes a `struct clone_args` with 64-bit flags, an explicit stack size, `set_tid`, `CLONE_PIDFD`, and `CLONE_INTO_CGROUP` [4]. None of those is needed for the minimum. glibc has no `clone3` wrapper, so a caller must use `syscall(2)` [4], and no Rust crate surveyed wraps it safely. `clone` has a glibc wrapper and a `nix` binding. Bookworm's kernel (6.1) supports `clone3`, so availability is not the constraint. Docker's default seccomp profile returns `ENOSYS` for `clone3` only to containers without `CAP_SYS_ADMIN` [9], so it does not bear on the privileged targets. Reconsider `clone3` when cgroup limits arrive: `CLONE_INTO_CGROUP` places the child in a cgroup at creation.
- **`CLONE_IO` is not the place to start.** The man page says the child "shares an I/O context with the calling process", where the I/O context is "the I/O scope of the disk scheduler" [5]. It tunes block-layer scheduling for threads doing I/O for one process. It isolates nothing and does not redirect stdin, stdout, or stderr. If the intent was "start with the I/O plumbing", the first milestone is a child whose stdio reaches the terminal (see I/O redirection).
- **Starting set:** `CLONE_NEWPID | CLONE_NEWNS | CLONE_NEWUTS | CLONE_NEWIPC`, with `SIGCHLD` as the exit signal so the parent can `waitpid` [5]. Creating these namespaces requires `CAP_SYS_ADMIN`; `CLONE_NEWUSER` is the exception [4]. Deferred: `CLONE_NEWNET` (requested), `CLONE_NEWCGROUP`, `CLONE_NEWUSER`.
- **Sharing flags stay unset.** The child is a separate process, not a thread, so `CLONE_VM`, `CLONE_FILES`, `CLONE_FS`, `CLONE_SIGHAND`, `CLONE_THREAD`, and `CLONE_PARENT` are off. `CLONE_FS` is rejected with `CLONE_NEWNS` (`EINVAL`), and `CLONE_THREAD` and `CLONE_PARENT` are rejected with `CLONE_NEWPID` [5].
- **PID 1 duties.** The first process in a PID namespace is init: it receives only signals it has handlers for (SIGKILL and SIGSTOP from an ancestor namespace still work), orphans reparent to it, and when it exits the kernel SIGKILLs the whole namespace [6].

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

Before `execve`, the child must also close every descriptor above 2 (or have opened them with `O_CLOEXEC`). A directory descriptor opened on the host before the `chroot` survives it, and `fchdir` on that descriptor returns the child to the host tree [15].

The `MS_PRIVATE` step matters: on systemd hosts `/` is a shared mount, and without it the child's `/proc` mount leaks back to the host [16]. Plain `chroot` is not a security boundary: it does not change the working directory, and the man page shows the escape `mkdir foo; chroot foo; cd ..` [15]. `pivot_root(".", ".")` followed by `umount2(".", MNT_DETACH)` detaches the old tree and closes that escape; it requires the new root to be a mount point [14]. The assignment asks only for chroot, so `pivot_root` is an optional hardening step.

### Safe Rust

Every direct Rust binding of `clone` and `fork` (`libc`, `nix`, `rustix`, `clone3`) is `unsafe`. Everything else in the pipeline has a safe binding. Verified against nix 0.31.3, rustix 1.1.5, and std [10][11][12]:

| Operation | nix 0.31.3 | rustix 1.1.5 | std |
|---|---|---|---|
| `clone` | `sched::clone` is `unsafe fn` (stack overflow and post-fork constraints) | none public | none |
| `chroot` | `unistd::chroot` safe | `process::chroot` safe | `std::os::unix::fs::chroot` safe, stable since 1.56 |
| `pivot_root`, `mount`, `sethostname`, `waitpid` | safe | safe | none (except `Child::wait`) |
| `execve` | safe | unsafe | `CommandExt::exec` safe |

**Chosen design:** one thin audited `unsafe` module. `nix::sched::clone` sits behind `#![deny(unsafe_code)]` at the crate root and a single `#[allow(unsafe_code)]` module of about 30 lines with a `SAFETY` comment: a single-threaded caller, a heap-allocated stack, and a child closure that only calls nix syscall wrappers before `execve`. A separate `-sys` workspace crate is an alternative layout. This is the pattern youki's `libcontainer` uses: one audited clone module, safe nix wrappers everywhere else [13].

### Binding choice: nix, rustix, or our own

A spike built the same launcher three ways (`research/spike/`): `clone` into new PID, mount, UTS, and IPC namespaces, then private mounts, hostname, `/proc`, chroot, exec, and wait, with a `thiserror` error type. All three run, show PID 1 and the container hostname, and leave the host hostname unchanged. Measured on x86_64, kernel 6.18, root, against a rootfs copied from the host rather than `bookworm-slim`:

| | `nix` 0.31 | `rustix` 1.1 plus `libc` for `clone` | `libc` only |
|---|---|---|---|
| `clone` | `sched::clone`, one `unsafe` call; nix handles the stack | none in rustix, so a hand-written trampoline | the same trampoline |
| Lines | 84 | 75 | 107 |
| `unsafe` blocks | 1 | 2 | 8 |
| Release size | 491 KB | 499 KB | 461 KB |
| Clean build | 5.9 s | 6.6 s | 4.8 s |
| Error text for a missing rootfs | `ENOENT: No such file or directory` | `No such file or directory (os error 2)` | `errno 2`, until a `strerror` shim is added |

rustix gives nothing here, because it has no `clone` and the trampoline brings back the `unsafe` it was meant to avoid. Rolling our own widens the audited surface from one call to eight and loses the errno text. The project uses nix.

### Typed errors

`thiserror` 2 supplies typed errors throughout. Each module has one error enum. Each syscall failure gets a variant that names the step (`Mount { target, source }`, `Hostname`, `Chroot`, `Exec`, `Wait`) and carries the errno as `#[source]`. `nix::errno::Errno` and `rustix::io::Errno` both implement `std::error::Error`, so they wrap directly. The child cannot return an error across the process boundary: it prints the typed error to stderr and exits 1, and the parent returns its own errors normally.

### I/O redirection

- **Inherit stdio (the minimum).** The child keeps the parent's descriptors 0, 1, and 2 across `clone` and `exec`; runc calls this the pass-through mode, `terminal: false` [18]. It is enough for `bcdocker run tinysys /bin/bash` from an interactive shell, and it makes host-side redirection work unchanged: `bcdocker run c /bin/ls > out.txt` and `cat f | bcdocker run c /bin/wc` write to and read from the host's descriptors. Bash may print a job-control warning in this mode.
- **Descriptor hygiene.** Every open descriptor crosses `exec`, not only 0 to 2. Close or `CLOEXEC`-mark everything above 2 before entering the container, or a host directory descriptor defeats the chroot (see the setup order).
- **Pipes.** Needed only to capture or log output; the runtime must pump them and the application loses terminal detection.
- **Pseudo-terminal (stretch).** Allocate a pty in the container's devpts, `setsid()` [28], `ioctl(TIOCSCTTY)`, `dup2` the slave onto 0, 1, 2, and proxy bytes between the parent's raw-mode terminal and the master [18].
- **Exit status.** The parent waits and returns the child's exit code, or 128 plus the signal number if the child was killed (the usual shell convention).
- **Signals.** A terminal sends Ctrl-C to the whole foreground process group, which includes the parent and the container's processes, so the parent decides whether to ignore SIGINT and SIGTERM or forward them with `kill`. Inside the container, PID 1 drops signals it has no handler for (see PID 1 duties), so a launcher-as-init that forwards signals to the application needs handlers of its own.

### Rootfs preparation

The rootfs is the extracted contents of `debian:bookworm-slim`, via `docker create` + `docker export` [29], or `crane export --platform linux/arm64 debian:bookworm-slim` (no daemon; works on macOS) [20]. The image is about 28 MB compressed per architecture, has the same userland as the run target, and can be pinned by digest [19]. It must match the target's architecture (Apple silicon runs arm64 Linux). Keep `rootfs/` in `.gitignore` and ship a script that builds it, so each host builds its own. The extracted image already holds the FHS skeleton (`bin sbin lib usr etc dev proc sys tmp var run root home`); bookworm uses merged `/usr`, so `/bin` and `/lib` are symlinks.

For `/dev`, mount a tmpfs and `mknod` null, zero, full, random, urandom, and tty, which OCI requires [17]. Do not bind the whole host `/dev`, and avoid `devtmpfs`, which exposes every host device. For `/etc`, the image already ships `passwd` and `group`; write `/etc/hostname` to match `sethostname`. `resolv.conf` is moot without networking.

### Platforms

| Environment | Namespaces, chroot, Linux binaries | Notes |
|---|---|---|
| **macOS native** | None: Darwin has no PID, UTS, or mount namespaces and cannot execute Linux ELF binaries | Build and edit host only. Gate Linux code with `cfg(target_os = "linux")`, declare `nix` under `[target.'cfg(target_os = "linux")'.dependencies]`, and have `bcdocker run` exit with a clear message on Darwin. A Darwin chroot jail is not a fallback: system libraries live only in the dyld shared cache since Big Sur, and it could not meet the PID or hostname requirements [24][25] |
| **Debian native** and the **`bookworm-slim` VM** | All available with root | Run targets |
| **`bookworm-slim` in Docker on Mac** | Runs on Docker Desktop's Linux VM kernel; needs elevated privileges (below) | Rootfs must be arm64 on Apple silicon |

**Docker privileges.** The default seccomp profile denies namespace `clone`, `unshare`, and `mount` unless the container has `CAP_SYS_ADMIN`, and denies `pivot_root` as a privileged operation [8]. The profile adjusts to the capabilities granted, and `CAP_SYS_CHROOT` is a default capability, so `chroot` alone works unprivileged [7]. Docker's default AppArmor profile denies `mount` where AppArmor is enforced [21]; whether Docker Desktop's VM enforces it is unknown. `--privileged` grants all capabilities and reconfigures AppArmor [7], so it covers both. Rootless Docker and Enhanced Container Isolation run containers in user namespaces, where the kernel refuses a fresh `/proc` mount that would reveal too much [23]; the mount is expected to fail there, but this was not tested.

To type-check Linux code from macOS, `cargo check --target aarch64-unknown-linux-gnu` needs no linker; `cargo zigbuild` or the musl target produces a binary [22]. A privileged `rust:1-bookworm` container with the repo bind-mounted is the simplest build-and-run loop on a Mac.

## Libraries & Skills

Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: none. No published agentic skill ships with `nix`, `rustix`, `libc`, or std, and none was found in this harness.

- **`nix` 0.31.3** [10]: `sched::{clone, unshare, CloneFlags}` (feature `sched`), `mount::{mount, MsFlags}` (`mount`), `unistd::{chroot, chdir, pivot_root, execve, sethostname}` (`fs`, `process`, `hostname`), `sys::wait::waitpid` (`process`). `clone` is `unsafe` and takes a caller-supplied stack slice; nix handles stack direction. Sched, mount, and `pivot_root` are Linux-only.
- **`rustix` 1.1.5** [11] covers everything except `clone`; see the binding comparison.
- **`thiserror` 2** for typed errors, as in `uefi_boot`.
- **Closest worked examples:** Litchi Pi's "Writing a container in Rust" series (crabcan, using nix) [26]; Liz Rice's containers-from-scratch in Go, with the same clone, chroot, and proc-mount shape as the tutorial [27]; youki for reference only [13].
- **Local convention:** the sibling `uefi_boot` project uses edition 2021, few dependencies, `panic = "abort"`, and a Makefile whose `install`, `build`, and `run` targets branch on `uname -s` for Darwin versus Debian. See `research/codebase.md`.

## Falsification/Refine

**"A chroot jail satisfies the assignment."** Refuted by the PID requirement [1], the lecture's "at least two new namespaces" [2], and the tutorial's flags [3]. A plain chroot leaves the process in the host PID namespace, so `ps` shows host PIDs, and `sethostname` renames the host.

**"Start with `CLONE_IO`."** Refuted by the man page [5]: it concerns disk scheduling, not isolation or stdio.

**"`clone3` is the modern choice."** True of the kernel interface, but it buys nothing the minimum needs, has no glibc wrapper [4], and has no safe Rust binding.

**"All environments can run the container."** Refuted for macOS native, as the platform table shows.

**"Safe Rust and `clone` are compatible."** Only with one `unsafe` block: every direct binding of `clone` is `unsafe` [10][11]. Confined to one audited module, it satisfies both requirements.

**Size.** One feature-sized project: a small binary (a few hundred lines) and a rootfs build script. Off-the-shelf tools (`unshare(1)` with `chroot(8)`, Docker, runc, youki) already do this, but the assignment is to build it, so they serve as references only.

**Smallest version that meets the intent:** `bcdocker run <rootfs-dir> <cmd> [args…]` creates new PID, UTS, mount, and IPC namespaces with `clone`, sets the hostname, makes mounts private, mounts `/proc`, chroots, and runs the application as a child of PID 1, waiting for it and returning its exit status, using a rootfs extracted from `bookworm-slim`.

**Not yet verified.** `pivot_root` and the `/proc` mount have not been run in Docker Desktop, nor has the rootless and Enhanced Container Isolation failure mode. Whether Docker Desktop's VM enforces AppArmor is unknown (moot under `--privileged`). Whether `--privileged` also disables the default seccomp profile is not stated on the Docker pages read [7][8]. The `pivot_root` and `/proc` checks run on a Linux host with Docker; the Docker Desktop checks need the Mac.

## Scope

**In scope for design:**
- The `run` subcommand and the launcher: `clone` into new PID, UTS, mount, and IPC namespaces, hostname, private mounts, `/proc`, chroot, and PID 1 behavior (requirements 1 to 9).
- The thin audited `unsafe` clone module and the full flag explanation.
- A scripted rootfs build from `bookworm-slim` for each host architecture.
- stdio inheritance, descriptor hygiene, host-side redirection, exit-status propagation, and signal handling in the launcher.
- Run targets: Debian native, the `bookworm-slim` VM, and privileged `bookworm-slim` in Docker on Mac; macOS as the build host with a clean unsupported-platform exit.

**Out of scope for now:** networking, `--memory` and `--pids-limit` cgroup limits, user, cgroup, and time namespaces, image pulling, overlayfs, OCI compatibility, rootless mode, the pty stretch goal, and submission logistics (repository layout, commits, report, slides, deadline).

## Sources

[1] H. Chen, "Project 2: Application Container," CISC 7310X Operating Systems I, CUNY Brooklyn College, Fall 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/assignment/bccontainer (accessed Oct. 7, 2026).
[2] H. Chen, "Process Abstraction and Isolation in Linux," lecture slides, CISC 7310X, Sep. 30, 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/lecture/processisolation.pdf
[3] H. Chen, "A Tutorial for BC Docker Project (OS Application Container)," video, 2023. [Online]. Available: http://www.sci.brooklyn.cuny.edu/~chen/uploads/course/CISC7310X/video/bcdocker.html (frames at 57:00, 1:17:00, 1:32:00, 1:47:00 in `research/video-frames/`).
[4] M. Kerrisk et al., "clone3(2)," Debian manpages, unstable. [Online]. Available: https://manpages.debian.org/unstable/manpages-dev/clone3.2.en.html
[5] M. Kerrisk, "clone(2)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man2/clone.2.html
[6] M. Kerrisk, "pid_namespaces(7)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man7/pid_namespaces.7.html
[7] Docker Inc., "Running containers." [Online]. Available: https://docs.docker.com/engine/containers/run/
[8] Docker Inc., "Seccomp security profiles for Docker." [Online]. Available: https://docs.docker.com/engine/security/seccomp/
[9] Moby, "seccomp: add support for clone3 syscall in default policy." [Online]. Available: https://git.causa-arcana.com/kotovalexarian-likes-github/moby--moby/commit/9f6b562dd12ef7b1f9e2f8e6f2ab6477790a6594
[10] nix-rust, "nix 0.31.3," docs.rs. [Online]. Available: https://docs.rs/nix/0.31.3/nix/
[11] bytecodealliance, "rustix 1.1.5," docs.rs. [Online]. Available: https://docs.rs/rustix/1.1.5/rustix/
[12] The Rust Project, "std::os::unix::process::CommandExt" and "std::os::unix::fs::chroot." [Online]. Available: https://doc.rust-lang.org/std/os/unix/process/trait.CommandExt.html
[13] youki-dev, "youki" and "libcontainer 0.7.0." [Online]. Available: https://github.com/youki-dev/youki
[14] M. Kerrisk, "pivot_root(2)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man2/pivot_root.2.html
[15] M. Kerrisk, "chroot(2)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man2/chroot.2.html
[16] M. Kerrisk, "mount_namespaces(7)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man7/mount_namespaces.7.html
[17] Open Container Initiative, "Linux Container Configuration," runtime-spec. [Online]. Available: https://github.com/opencontainers/runtime-spec/blob/main/config-linux.md
[18] Open Container Initiative, "Terminals and Standard IO," runc docs. [Online]. Available: https://github.com/opencontainers/runc/blob/main/docs/terminals.md
[19] Docker Library, "repo-info: debian:bookworm-slim." [Online]. Available: https://github.com/docker-library/repo-info/blob/master/repos/debian/remote/bookworm-slim.md
[20] Google, "crane export," go-containerregistry. [Online]. Available: https://github.com/google/go-containerregistry/blob/main/cmd/crane/doc/crane_export.md
[21] Moby, "AppArmor docker-default template," moby/profiles. [Online]. Available: https://raw.githubusercontent.com/moby/profiles/main/apparmor/template.go
[22] rust-cross, "cargo-zigbuild." [Online]. Available: https://github.com/rust-cross/cargo-zigbuild
[23] A. Crequy, "[PATCH] namespace.c: Allow some unprivileged proc mounts when not fully visible," LKML, Apr. 2018. [Online]. Available: https://lkml.iu.edu/hypermail/linux/kernel/1804.0/02051.html
[24] Apple, "chroot(2)," macOS System Calls Manual. [Online]. Available: https://keith.github.io/xcode-man-pages/chroot.2.html
[25] Apple Developer Forums, thread 667340 (Big Sur dynamic linker cache), and Apple, "Technical Q&A QA1118." [Online]. Available: https://developer.apple.com/forums/thread/667340
[26] Litchi Pi, "Writing a container in Rust." [Online]. Available: https://litchipi.github.io/series/container_in_rust
[27] L. Rice, "containers-from-scratch." [Online]. Available: https://github.com/lizrice/containers-from-scratch
[28] M. Kerrisk, "setsid(2)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man2/setsid.2.html
[29] Docker Inc., "docker container export." [Online]. Available: https://docs.docker.com/reference/cli/docker/container/export/
