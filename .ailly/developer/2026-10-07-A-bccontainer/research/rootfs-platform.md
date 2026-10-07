# bccontainer: rootfs preparation, isolation ordering, and platform notes

Researched 2026-10-07. Citations are IEEE-style, keyed to the Sources list at the end. Each claim is tagged **[V]** if verified against a primary source this session, or **[I]** if it is an inference or comes from memory and was not directly verified.

The assignment page [1] only requires a `bcdocker run <container_name> <application>` interface, PID 1 inside the container, and a container built by hand "with the Linux directory structure / FHS". It defers the concrete chroot-preparation steps to an instructor video. Everything below is engineering choice, not a stated requirement. **[V]**

## Findings

### 1. Preparing the chroot rootfs

| Option | How | Size | Reproducibility | Notes |
|---|---|---|---|---|
| **Extract `debian:bookworm-slim`** (recommended) | `docker create --platform linux/$ARCH debian:bookworm-slim` + `docker export` [9]; or `crane export --platform linux/arm64 debian:bookworm-slim rootfs.tar` [8] (no daemon needed) | ~28 MB compressed per arch (amd64 28.2 MB, arm64v8 28.1 MB) [10]; roughly 75 MB unpacked **[I]** | Official images are built with debuerreotype from snapshot.debian.org and are timestamped [10][11]. Pin by digest for byte-identical results | Same userland as the run target. Works on macOS (crane is a static Go binary). `docker export` flattens layers and omits volumes [9] |
| **debootstrap --variant=minbase bookworm** | `sudo debootstrap --variant=minbase --arch=arm64 bookworm ./rootfs http://deb.debian.org/debian` | Larger than slim (keeps docs and locales) **[I]** | Not reproducible by default | Needs a Linux host and root. Cross-arch needs `--foreign` + `--second-stage` (or qemu-user-static) [6]. Will not run on macOS |
| **mmdebstrap** | `mmdebstrap --variant=minbase bookworm rootfs.tar` | Similar to debootstrap, or smaller with `--variant=essential` | Supports `SOURCE_DATE_EPOCH`; cleans apt caches; about 2x faster than debootstrap [7] | `--mode=unshare` runs without root. Foreign arch through qemu-user [7] |
| **BusyBox static** | `apt install busybox-static`; copy `/bin/busybox` into `rootfs/bin`, then `busybox --install -s rootfs/bin` | ~1-2 MB **[I]** | Trivial | Gives `sh`, `ls`, and `ps`, but not `/bin/bash`, which the assignment examples use [1]. Good as a second "tinysys" demo |

**FHS skeleton.** Needs `bin sbin lib lib64 (amd64 only) usr etc dev proc sys tmp (1777) root home var run`. Debian bookworm uses merged-/usr, so `/bin`, `/lib`, and `/sbin` are symlinks into `/usr`. An extracted image already contains all of these. **[I]**

**/proc.** Mount a fresh `proc` inside the new PID namespace. Without it, `ps` shows the host's PIDs [13]. The OCI default filesystems are proc on /proc, sysfs on /sys, devpts on /dev/pts, and tmpfs on /dev/shm [12]. **[V]**

**/dev.** OCI requires `/dev/null, zero, full, random, urandom, tty` [12]. **[V]** Three ways to provide them:
- (a) Mount a tmpfs on `rootfs/dev`, then `mknod` each device (null 1:3, zero 1:5, full 1:7, random 1:8, urandom 1:9, tty 5:0) or bind-mount the host nodes. Device numbers are from memory **[I]**. Docker keeps CAP_MKNOD by default [4].
- (b) Bind-mount the host `/dev` (`MS_BIND|MS_REC`). This is the simplest, but it exposes every host device.
- (c) `devtmpfs`. Avoid it: it is a single kernel-wide instance that shows all host devices. **[I]**

`/dev/console` is a bind of the pty when a terminal is allocated [12]. `/dev/ptmx` should point at `pts/ptmx` [12].

**/etc.** The image already ships `/etc/passwd` and `/etc/group` with root. Write `/etc/hostname` to match `sethostname`. `resolv.conf` is irrelevant while there is no networking, so leave it empty or copy the host's. **[I]**

**Multi-arch.** Docker Desktop on Apple silicon is arm64, and amd64 images run under emulation [15]. **[V]** Extract the rootfs for the arch the VM runs (`uname -m` gives `aarch64`). An amd64 rootfs inside an arm64 VM only runs through binfmt/qemu or Rosetta, and the result is confusing, so avoid it. Keep `rootfs/` out of git (`.gitignore`) and ship a `scripts/mkrootfs.sh` instead. **[I]**

### 2. chroot vs pivot_root vs mount namespace

- **chroot(2)** needs `CAP_SYS_CHROOT` and does *not* change the working directory. The man page states it is "not intended to be used for any kind of security purpose" and shows the escape `mkdir foo; chroot foo; cd ..` [3]. **[V]** Further escapes: an fd opened before the chroot, a second chroot, `/proc/1/root` if the host /proc is visible, or a still-mounted host fs. **[I]**
- **pivot_root(2)** requires `new_root` to be a mount point. It fails with EINVAL if the current root is not a mount point (for example after an earlier chroot), if the root is the initramfs `rootfs`, or if a mount involved has shared propagation [2]. **[V]** The idiom is `chdir(new_root); pivot_root(".", "."); umount2(".", MNT_DETACH)` [2]. **[V]** After that the old host tree is detached, which closes the `..`/fd escapes that remain with chroot. **[I]**
- **Propagation.** systemd makes `/` `MS_SHARED`. `unshare` does the equivalent of `mount --make-rprivate /` in the new namespace [5]. **[V]** Without this step, your `/proc` mount leaks back to the host. **[I]**

**Correct ordering.** The assignment needs only clone + chroot.

```
parent: clone(child, stack, CLONE_NEWNS|CLONE_NEWPID|CLONE_NEWUTS|CLONE_NEWIPC|SIGCHLD)
        (CAP_SYS_ADMIN needed for all of these [14])
child:  mount(NULL, "/", NULL, MS_REC|MS_PRIVATE, NULL)          // stop propagation
        sethostname(name)                                        // UTS ns
        mount(rootfs, rootfs, NULL, MS_BIND|MS_REC, NULL)         // make it a mount point (needed for pivot_root, harmless for chroot)
        mount("proc", rootfs/proc, "proc", MS_NOSUID|MS_NOEXEC|MS_NODEV, NULL)
        [optional: tmpfs on rootfs/dev + device nodes; devpts on rootfs/dev/pts]
        chdir(rootfs); chroot(".") ; chdir("/")                  // OR pivot_root(".", "."); umount2(".", MNT_DETACH)
        execve(app, argv, envp)
parent: waitpid(pid, &status, 0) -> exit code
```

`SIGCHLD` must be the exit signal, or the parent has to wait with `__WALL` [14]. **[V]** In Rust, `nix::sched::clone` is `unsafe`, Linux/Android only, and behind the `sched` feature [18]. **[V]** Mounting /proc before or after the chroot is equivalent (`/proc` vs `rootfs/proc`). Mounting before keeps all the path logic in one place.

### 3. Running inside Docker on Mac

- The default seccomp profile blocks `clone`/`unshare` with namespace flags, `mount`, `umount2`, and `pivot_root`. Most of these are also gated on CAP_SYS_ADMIN [4]. **[V]**
- Default capabilities *include* `SYS_CHROOT` and `MKNOD` [4]. **[V]** Plain `chroot` therefore works in an unprivileged container. The namespaces and mounts it is paired with do not.
- Adding `--cap-add SYS_ADMIN` makes Docker relax seccomp for those syscalls automatically [4]. **[V]** The `docker-default` AppArmor profile still has `deny mount,` [19] **[V]**, so you also need `--security-opt apparmor=unconfined` on hosts that enforce AppArmor (a Debian VM running Docker). Whether Docker Desktop's LinuxKit VM enforces AppArmor at all is **unresolved**.
- **Recommended:** `docker run --rm -it --privileged -v "$PWD":/src bookworm-dev`. The minimal alternative is `--cap-add SYS_ADMIN --security-opt seccomp=unconfined --security-opt apparmor=unconfined`. **[I]**
- **/proc inside a container.** Docker masks paths such as `/proc/kcore`. The kernel's `mount_too_revealing` check refuses a fresh proc mount only in a *non-init user namespace* [20]. **[V]** Rootful Docker (Desktop's default) is therefore fine. Rootless Docker or Docker Desktop "Enhanced Container Isolation" (which uses user namespaces) would fail to mount /proc. **[I]**
- **Correction to the premise "pivot_root fails on rootfs overlay":** pivot_root fails on the initramfs *rootfs* (hence runc's `--no-pivot-root` / `DOCKER_RAMDISK`) [16]. **[V]** A Docker container's root is an overlay *mount*, not rootfs. After `make-rprivate` and a bind of new_root onto itself, pivot_root should work (Docker-in-Docker relies on this). **[I, medium-high confidence]** chroot works in either case. A rootfs directory that sits on the container's overlayfs is fine for a bind mount + chroot.
- cgroup v2 nesting only matters for the optional `--memory`/`--pids-limit` extras [1]. It needs a writable `/sys/fs/cgroup` (`--privileged` or `--cgroupns=private` + rw). **[I]**

### 4. macOS development

- macOS has no `clone` namespaces, `mount(2)` semantics, or `chroot` equivalent for this purpose, so the code must be gated:
  - put `#[cfg(target_os = "linux")] mod linux;` in the module that touches namespaces;
  - add a `#[cfg(not(target_os = "linux"))]` stub that returns "unsupported platform";
  - declare `nix` with `features = ["sched","mount","hostname","process","fs"]` under `[target.'cfg(target_os = "linux")'.dependencies]`.

  This keeps `cargo check`/`cargo test` green on the Mac. **[I]**
- To type-check Linux code from macOS, run `rustup target add aarch64-unknown-linux-gnu` and then `cargo check --target aarch64-unknown-linux-gnu`. This needs no linker. Linking needs `cargo zigbuild --target aarch64-unknown-linux-gnu[.2.36]` [17] **[V]**, or the musl target (`aarch64-unknown-linux-musl`), which gives a static binary that runs inside any rootfs or VM. `cross` needs Docker. **[I]**
- **Simplest loop:** a Docker dev container from `rust:1-bookworm`, bind-mounting the repo and run `--privileged`. Use `cargo build` + `sudo ./target/debug/bcdocker run tinysys /bin/bash` inside it. A Lima/Colima/OrbStack Debian VM [21] gives a "real" Debian VM that matches the grading target. **[I]**

### 5. I/O wiring (minimal)

- **Inherit (pass-through).** The child gets the parent's fds 0/1/2 over clone/execve. This is runc's `terminal: false` "pass-through" mode [22]. **[V]** It is enough for `bcdocker run tinysys /bin/bash` from an interactive shell: bash sees a tty on stdin and runs interactively. Job control may warn ("no job control") because there is no new session or controlling tty. **[I]**
- **Pipes.** Use pipes for capture or logging. The runtime must pump them, and the program loses tty detection. Not needed here.
- **PTY (runc `terminal: true`).** Allocate the pty in the container's devpts and use the slave as stdio [22]. The child calls `setsid()`, which creates a session with no controlling terminal [23] **[V]**, then `ioctl(TIOCSCTTY)` and `dup2` onto 0/1/2. The parent proxies data between its own raw-mode tty and the master. Treat this as a stretch goal.
- **PID 1 duties.** Inside a new PID namespace the exec'd app is PID 1. It receives only signals it has handlers for, so Ctrl-C/SIGTERM may be ignored. Orphans are reparented to it, and when it exits every process in the namespace gets SIGKILL [13]. **[V]** A minimal runtime can accept this, or fork a tiny init that reaps children and forwards signals, as tini does: forward signals, reap zombies, and propagate the child's exit code [24]. **[V]**
- **Exit code.** In the parent, after `waitpid`, use `WEXITSTATUS`, or `128+WTERMSIG` if the child was signalled. This is the shell/Docker convention. **[I]**
- **Signal forwarding (inherit mode).** The terminal sends SIGINT to the foreground process group, which includes both the runtime and the child unless `setsid` was called. The runtime should ignore SIGINT/SIGTERM while waiting, or forward them with `kill(pid, sig)`. **[I]**

### Unresolved
- Whether Docker Desktop's LinuxKit VM enforces AppArmor (moot if `--privileged`).
- Exact unpacked size of bookworm-slim and of a minbase debootstrap. Measure with `du -sh`.
- pivot_root inside Docker Desktop was not tested empirically this session.
- The instructor video's exact rootfs recipe (it may expect a hand-copied `ldd`-based tinysys).

## Sources

[1] H. Chen, "Project 2: Application Container (bccontainer)," CISC 7310X, Fall 2026. https://huichen-cs.github.io/course/CISC7310X/26FA/assignment/bccontainer
[2] M. Kerrisk, "pivot_root(2)," Linux man-pages. https://man7.org/linux/man-pages/man2/pivot_root.2.html
[3] M. Kerrisk, "chroot(2)," Linux man-pages. https://man7.org/linux/man-pages/man2/chroot.2.html
[4] Docker Inc., "Running containers" (runtime privilege and capabilities) and "Seccomp security profiles for Docker." https://docs.docker.com/engine/containers/run/ ; https://docs.docker.com/engine/security/seccomp/
[5] M. Kerrisk, "mount_namespaces(7)," Linux man-pages. https://man7.org/linux/man-pages/man7/mount_namespaces.7.html
[6] Debian, "debootstrap(8)," bookworm manpages. https://manpages.debian.org/bookworm/debootstrap/debootstrap.8.en.html
[7] J. Schauer, "mmdebstrap(1)," bookworm manpages. https://manpages.debian.org/bookworm/mmdebstrap/mmdebstrap.1.en.html
[8] Google, "crane export," go-containerregistry. https://github.com/google/go-containerregistry/blob/main/cmd/crane/doc/crane_export.md
[9] Docker Inc., "docker container export." https://docs.docker.com/reference/cli/docker/container/export/
[10] Docker Library, "repo-info: debian:bookworm-slim." https://github.com/docker-library/repo-info/blob/master/repos/debian/remote/bookworm-slim.md
[11] T. Gianelloni et al., "debuerreotype." https://github.com/debuerreotype/debuerreotype
[12] Open Container Initiative, "Linux Container Configuration," runtime-spec. https://github.com/opencontainers/runtime-spec/blob/main/config-linux.md
[13] M. Kerrisk, "pid_namespaces(7)," Linux man-pages. https://man7.org/linux/man-pages/man7/pid_namespaces.7.html
[14] M. Kerrisk, "clone(2)," Linux man-pages. https://man7.org/linux/man-pages/man2/clone.2.html
[15] Docker Inc., "Install Docker Desktop on Mac." https://docs.docker.com/desktop/setup/install/mac-install/
[16] Docker Community Forums, "TinyCore 8.0 x86 - pivot_root invalid argument." https://forums.docker.com/t/tinycore-8-0-x86-pivot-root-invalid-argument/32633
[17] rust-cross, "cargo-zigbuild." https://github.com/rust-cross/cargo-zigbuild
[18] nix-rust, "nix::sched::clone," docs.rs. https://docs.rs/nix/latest/nix/sched/fn.clone.html
[19] Moby, "AppArmor docker-default template," moby/profiles. https://raw.githubusercontent.com/moby/profiles/main/apparmor/template.go
[20] A. Crequy, "[PATCH] namespace.c: Allow some unprivileged proc mounts when not fully visible," LKML, Apr. 2018. https://lkml.iu.edu/hypermail/linux/kernel/1804.0/02051.html
[21] Lima project, "Lima documentation." https://lima-vm.io/docs/
[22] Open Container Initiative, "Terminals and Standard IO," runc docs. https://github.com/opencontainers/runc/blob/main/docs/terminals.md
[23] M. Kerrisk, "setsid(2)," Linux man-pages. https://man7.org/linux/man-pages/man2/setsid.2.html
[24] T. Orozco, "tini." https://github.com/krallin/tini
