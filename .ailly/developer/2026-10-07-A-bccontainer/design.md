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

**Journey.** The student works on Debian or in a privileged `bookworm-slim` container on a Mac, from the project directory.

1. `cargo build`. A macOS build succeeds; running there is declined (see Failure modes).
2. `scripts/mkrootfs.sh tinysys` extracts `debian:bookworm-slim` into `./containers/tinysys/`, using `docker export` or `crane export`.
3. `sudo target/debug/bcdocker run tinysys /bin/sh` opens a shell in the container:
   - `cat /proc/sys/kernel/hostname` prints `tinysys`.
   - `echo $$` prints `2`; the launcher is PID 1.
   - Only the container's processes appear in `/proc`.
   - `exit 3` returns to the host prompt, and `echo $?` prints `3`.
4. `sudo target/debug/bcdocker run tinysys /bin/ls -l /etc` prints the container's `/etc`, and `> out.txt` or `| wc` on the host side work as in any shell.

**Metrics.** The feature test passes on a Debian host and in privileged `bookworm-slim` on Docker Desktop. After a run, the host has no leftover mounts and an unchanged hostname, and the rootfs directory is unchanged. Every failure ends with one line on stderr naming the step and the reason.

## Specification

**Command line.** `bcdocker run <container> <app> [args…]`.
- `<container>` without a `/` names the directory `./containers/<container>`, which is listed in `.gitignore`. With a `/` it is a path. The hostname is the final path component.
- `<app>` is a path inside the container; arguments pass through unchanged.
- A missing argument prints usage and exits non-zero.

**Isolation.** The container gets new PID, mount, UTS, and IPC namespaces, created by one `clone`. Its mounts are private, so nothing it mounts is visible to the host and everything it mounts disappears when it exits. Inside, `/` is the container's directory (changed with `chroot`), `/proc` is a fresh procfs for the container's PID namespace, and `/dev` is a tmpfs holding `null`, `zero`, `full`, `random`, `urandom`, and `tty`. The rootfs directory itself is never modified by a run.

**Process shape.** The process `bcdocker run …` on the host starts the container and waits. In the container, PID 1 is that same `bcdocker` program with its original command line; it starts the application as PID 2, reaps any orphaned processes, and exits with the application's status. When PID 1 exits, the kernel ends every process in the container. The container also ends if the host-side `bcdocker` is killed.

**Application environment.** The application inherits stdin, stdout, and stderr, so terminal use and host-side redirection behave as with any command. It sees no other host file descriptors. It inherits the launcher's environment, with `PATH` set to the Debian default so programs in the container are found.

**Exit status.** The host-side `bcdocker` exits with the application's exit code, or 128 plus the signal number if a signal ended it. Ctrl-C ends the application and the container.

**Failure modes.** Each ends with `bcdocker: <step>: <reason>` on stderr, from a typed error, and a non-zero exit.

| Situation | Message names |
|---|---|
| Not Linux | that bcdocker needs Linux namespaces; the macOS build otherwise works |
| Not root or missing privilege | that bcdocker needs root; under Docker, the message suggests `--privileged` |
| Container directory missing | the path it looked for |
| Application missing or not executable | the application path, with the system's reason |

**Building a rootfs.** `scripts/mkrootfs.sh <name>` creates `./containers/<name>/` from `debian:bookworm-slim` for the machine's architecture. It builds in a temporary directory and renames it into place, so a failed build leaves nothing behind, and it refuses to overwrite an existing container. It uses Docker if available, otherwise crane. A VM with neither installs one, or copies in a tarball made elsewhere.

**Project layout.** One binary crate `bcdocker` in the project root, edition 2021 as in `uefi_boot`, with `thiserror` 2 and `nix` 0.31 as its only dependencies. `src/` holds the launcher, one `#[allow(unsafe_code)]` clone module under `#![deny(unsafe_code)]`, and the error enums.

**Out of scope.** Networking, cgroup limits, user namespaces, image pulling, overlayfs, a pseudo-terminal, reserved exit codes, an architecture check, signal forwarding, and the written explanation of each `clone` flag (report material, deferred with the submission logistics).

**Verification.** Automated: the feature test builds a rootfs and checks PID 1 and PID 2, `/proc` contents, hostname isolation, filesystem isolation, no leftover mounts, the exit status of a normal exit and of a signal, and the failure messages for a missing application, a non-executable application, and a missing container. Manual: run it once on the `bookworm-slim` VM and once in privileged `bookworm-slim` on Docker Desktop, including Ctrl-C in an interactive shell, running without root, and a rootfs built for the other architecture.

## Alternatives

- **Path only.** `bcdocker run <rootfs-path> <app>`, with no name resolution. Simplest, but it differs from the assignment's command line (`run bctinysys …`).
- **Named containers with metadata, `bcdocker mkrootfs`, re-exec init.** A `config.toml` per container, a Rust tar extractor, and PID 1 re-executing itself. Closest to real Docker, but it adds a tar crate and a TOML parser, drifts toward image pulling, and makes PID 1's command line differ from the sample unless copied over.

The chosen approach keeps the small in-process launcher, matches the assignment's command line and sample output, and adds only name resolution.

## Summary

**Deferred.** `clone3` for `CLONE_INTO_CGROUP` when cgroup limits arrive; `pivot_root` hardening in place of plain `chroot`; a pseudo-terminal; networking; image pulling; reserved exit codes; signal forwarding; an architecture check for foreign rootfs directories.

**Constraint for the plan.** The `clone` module is the only place `unsafe` appears. Starting the application, waiting for it, and any signal handling use safe routes (`std::process::Command`, nix's safe wrappers) or are left out.
