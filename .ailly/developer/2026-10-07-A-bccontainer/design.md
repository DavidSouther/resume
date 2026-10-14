# bcdocker: Design

Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: none. No published agentic skill ships with `nix`, `rustix`, `libc`, `thiserror`, or std, and none was found in this harness (see `research.md`, Libraries & Skills).

Feature test: `pages/course/cisc_7310/bccontainer/tests/run.sh`, run with `cargo build && sudo tests/run.sh`.

## Purpose

`bcdocker` runs a Linux program inside a container: the program sees its own process tree where the first process is PID 1, its own hostname, and its own filesystem, while sharing the host's kernel. It is the BCDocker project of CISC 7310X, written in Rust, and it stays small enough to read in one sitting: the point is to see `clone`, namespaces, `chroot`, and `/proc` working together.

## Prior Art

- The course assignment, lecture, and tutorial video: the `bcdocker run <container> <application>` command line, the sample `ps axf` output with the launcher as PID 1, and the `clone` plus `chroot` recipe.
- Liz Rice's containers-from-scratch (Go) and Litchi Pi's crabcan (Rust, nix): the same flow in miniature.
- runc and youki: the production versions. youki's one audited `unsafe` clone module is the model for the safe-Rust boundary.
- `unshare(1)` with `chroot(8)`, Docker, and runc already do this. None is suitable because the assignment is to build the launcher.

## User Journey and Metrics

**Journey.** The student works on Debian, or on a Mac: there the binary is built in a `rust:1-bookworm` container, the rootfs is built with Docker on the Mac, and `bcdocker` runs in a privileged `debian:bookworm-slim` container with the project bind-mounted. Either way, from the project directory.

1. `cargo build`. A macOS build succeeds; running there is declined (see Failure modes).
2. `scripts/mkrootfs.sh tinysys` extracts `debian:bookworm-slim` into `./containers/tinysys/`, using `docker export` or `crane export`. A second argument names another image (`scripts/mkrootfs.sh tinysys ubuntu:24.04`).
3. `sudo target/debug/bcdocker run tinysys /bin/sh` opens a shell in the container:
   - `cat /proc/sys/kernel/hostname` prints `tinysys`.
   - `echo $$` prints `2`; the launcher is PID 1.
   - Only the container's processes appear in `/proc`.
   - `exit 3` returns to the host prompt, and `echo $?` prints `3`.
4. `sudo target/debug/bcdocker run tinysys /bin/ls -l /etc` prints the container's `/etc`, and `> out.txt` or `| wc` on the host side work as in any shell.

**Metrics.** The feature test passes on a Debian host and in privileged `bookworm-slim` on Docker Desktop. After a run, the host has no leftover mounts and an unchanged hostname, and `bcdocker`'s own setup has not modified the rootfs directory (the application can write to it as it would to any root filesystem). Every failure ends with one line on stderr naming the step and the reason.

## Specification

**Command line.** `bcdocker run [--stack-size <size>] <container> <app> [args…]`.
- `<container>` without a `/` names the directory `./containers/<container>`, which is listed in `.gitignore`. With a `/` it is a path. The hostname is the final path component.
- `<app>` is a path inside the container; arguments pass through unchanged. At most 16384 arguments are accepted, which bounds a copy glibc can make of them on the child's stack; more prints a usage error naming the limit.
- `--stack-size` sets the child's stack, in bytes or with a `K`, `M`, or `G` suffix (`--stack-size 2M` or `--stack-size=2M`). It goes before the container, defaults to 8M, and must be between 1M and 1G, so the safety argument below holds for every accepted value. After the application, `--stack-size` is the application's own argument.
- A missing argument or an unknown option before the container prints usage and exits non-zero.

**Isolation.** The container gets new PID, mount, UTS, and IPC namespaces, created by one `clone`. Its mounts are private, so nothing it mounts is visible to the host and everything it mounts disappears when it exits. Inside, `/` is the container's directory (changed with `chroot`), `/proc` is a fresh procfs for the container's PID namespace, and `/dev` is a tmpfs holding `null`, `zero`, `full`, `random`, `urandom`, and `tty`. `bcdocker`'s own setup never modifies the rootfs directory; the application can write to it as it would to any root filesystem.

**Process shape.** The process `bcdocker run …` on the host starts the container and waits. In the container, PID 1 is that same `bcdocker` program with its original command line; it starts the application as PID 2, reaps any orphaned processes, and exits with the application's status. When PID 1 exits, the kernel ends every process in the container. The container also ends if the host-side `bcdocker` is killed.

**Application environment.** The application inherits stdin, stdout, and stderr, so terminal use and host-side redirection behave as with any command. It sees no other host file descriptors. It inherits the launcher's environment, with `PATH` set to the Debian default so programs in the container are found.

**Exit status.** The host-side `bcdocker` exits with the application's exit code, or 128 plus the signal number if a signal ended it. Ctrl-C ends the application and the container.

**Failure modes.** Each ends with one line on stderr, `bcdocker: <step>: <reason>`, where `<step>` names the operation that failed (such as `privilege`, `container`, `clone`, or `exec /bin/sh`), from a typed error, and a non-zero exit.

| Situation | Message names |
|---|---|
| Not Linux | that bcdocker needs Linux namespaces; the macOS build otherwise works |
| Not root or missing privilege | that bcdocker needs root; under Docker, the message suggests `--privileged` |
| Container directory missing | the path it looked for |
| Application missing or not executable | the application path, with the system's reason |

**Building a rootfs.** `scripts/mkrootfs.sh <name> [image]` creates `./containers/<name>/` from the image, `debian:bookworm-slim` by default, for the machine's architecture. It builds in a temporary directory and renames it into place, so a failed build leaves nothing behind, and it refuses to overwrite an existing container. The name becomes the hostname, so it must be 1 to 64 bytes of UTF-8, not `.` or `..`, with no `/` (the script checks all but the UTF-8). It uses Docker if the Docker daemon is reachable, otherwise crane. A VM with neither installs one, or copies in a tarball made elsewhere.

**Project layout.** One binary crate `bcdocker` in the project root, edition 2021 as in `uefi_boot`, with `thiserror` 2 and `nix` 0.31 as its only dependencies. `src/` holds the launcher, one `#[allow(unsafe_code)]` clone module under `#![deny(unsafe_code)]`, and the error enums.

**Out of scope.** Networking, cgroup limits, user namespaces, image pulling, overlayfs, a pseudo-terminal, reserved exit codes, an architecture check, and signal forwarding. The report's written explanation of each `clone` flag is deferred with the submission logistics; the per-flag explanation itself now lives in the code, on `CLONE_FLAGS` in `src/clone.rs`.

**Verification.** Automated: the feature test builds a rootfs and checks PID 1 and PID 2, `/proc` contents, hostname isolation, filesystem isolation, no leftover mounts, the exit status of a normal exit and of a signal, and the failure messages for a missing application, a non-executable application, and a missing container. Manual: run it once on the `bookworm-slim` VM and once in privileged `bookworm-slim` on Docker Desktop, including Ctrl-C in an interactive shell, running without root, and a rootfs built for the other architecture. `tests/stack.sh` measures how deep the child's stack goes and runs on each target too.

## Alternatives

- **Path only.** `bcdocker run <rootfs-path> <app>`, with no name resolution. Simplest, but it differs from the assignment's command line (`run bctinysys …`).
- **Named containers with metadata, `bcdocker mkrootfs`, re-exec init.** A `config.toml` per container, a Rust tar extractor, and PID 1 re-executing itself. Closest to real Docker, but it adds a tar crate and a TOML parser, drifts toward image pulling, and makes PID 1's command line differ from the sample unless copied over.

- **`clap` for the command line.** Measured with the one option above: the release binary grows from 563 KB to 1.13 MB, the dependency tree from 13 crates to 27, and a clean release build from 5 s to 10 s. It would add `--help` and `--version`, and it handles application arguments that look like options. For one optional flag the 25-line hand-written parser is enough, and it keeps the crate small enough to read in one sitting.

The chosen approach keeps the small in-process launcher, matches the assignment's command line and sample output, and adds only name resolution.

## Summary

**Deferred.** `clone3` for `CLONE_INTO_CGROUP` when cgroup limits arrive; `pivot_root` hardening in place of plain `chroot`; a pseudo-terminal; networking; image pulling; reserved exit codes; signal forwarding; an architecture check for foreign rootfs directories.

**Constraint for the plan.** The `clone` module is the only place `unsafe` appears. Starting the application, waiting for it, and any signal handling use safe routes (`std::process::Command`, nix's safe wrappers) or are left out. The child's stack is a heap buffer with no guard page, because a guard page would need four more `unsafe` calls; this is an accepted risk. Its proof therefore rests on one named assumption: the child's stack use stays below the 1 MiB floor that `--stack-size` accepts. That is measured and tested, not proved: the child uses 16 KiB in a debug build and 12 to 16 KiB in release, so the floor is 64 times the debug figure and the default is 512 times; the depth does not change with the stack size, and 2000 arguments and a 100 KB environment add at most one 4 KiB page in release; and `tests/stack.sh` fails if it ever exceeds 64 KiB. Caller input affects the depth only through the argument count: when glibc's `execvp` retries a file that is not an executable format through `/bin/sh`, it copies the argument array onto that stack, and the cap of 16384 arguments keeps that copy to about 128 KiB. As measured, glibc gives the stack its own anonymous mapping rather than carving it from the brk heap; that is allocator behaviour, not a guarantee. Toolchain: rustc 1.96 or later (`rust-version`).
