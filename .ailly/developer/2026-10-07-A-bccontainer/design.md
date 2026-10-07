# bcdocker: Design

*Draft 2026-10-07*

Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: none. No published agentic skill ships with `nix`, `rustix`, `libc`, `thiserror`, or std, and none was found in this harness (see `research.md`, Libraries & Skills).

Feature test: `pages/course/cisc_7310/bccontainer/tests/run.rs`.

## Purpose

`bcdocker` runs a Linux program inside a container: the program sees its own process tree where the first process is PID 1, its own hostname, and its own filesystem, while sharing the host's kernel. It is the BCDocker project of CISC 7310X, written in Rust, and it stays small enough to read in one sitting: the point is to see `clone`, namespaces, `chroot`, and `/proc` working together.

## Prior Art

- The course assignment, lecture, and tutorial video: the `bcdocker run <container> <application>` command line, the sample `ps axf` output with the launcher as PID 1, and the `clone` plus `chroot` recipe.
- Liz Rice's containers-from-scratch (Go) and Litchi Pi's crabcan (Rust, nix): the same flow in miniature.
- runc and youki: the production versions. youki's one audited `unsafe` clone module is the model for the safe-Rust boundary.
- `unshare(1)` with `chroot(8)`, Docker, and runc already do this. None is suitable because the assignment is to build the launcher.

## User Journey and Metrics

**Journey.** The student works on Debian or in a privileged `bookworm-slim` container on a Mac.

1. `cargo build` (a macOS build succeeds; running there is declined, see Failure modes).
2. `scripts/mkrootfs.sh tinysys` extracts `debian:bookworm-slim` into `containers/tinysys/`, using `docker export` or `crane export`.
3. `sudo target/debug/bcdocker run tinysys /bin/sh` opens a shell in the container:
   - `hostname` prints `tinysys`.
   - `echo $$` prints `2`; the launcher is PID 1.
   - `ls /proc` shows only the container's processes.
   - `exit 3` returns to the host prompt, and `echo $?` prints `3`.
4. `sudo target/debug/bcdocker run tinysys /bin/ls -l /etc` prints the container's `/etc`, and `> out.txt` or `| wc` on the host side work as in any shell.

**Metrics.** The feature test passes on a Debian host and in privileged `bookworm-slim` on Docker Desktop. Startup, excluding the one-time rootfs build, is under one second. Every failure in the table below ends with one line on stderr naming the step and the reason. After the run, no mounts, files, or hostname changes remain on the host.

## Specification

**Command line.** `bcdocker run <container> <app> [args…]`.
- `<container>` without a `/` names a directory under `$BCDOCKER_HOME` (default `./containers`). With a `/` it is a path. The hostname is the final path component.
- `<app>` is a path inside the container; arguments pass through unchanged.
- A missing argument prints usage and exits 2.

**Isolation.** The container gets new PID, mount, UTS, and IPC namespaces, created by one `clone`. Its mounts are private, so nothing it mounts is visible to the host and everything it mounts disappears when it exits. Inside, `/` is the container's directory (changed with `chroot`), `/proc` is a fresh procfs for the container's PID namespace, and `/dev` is a tmpfs holding `null`, `zero`, `full`, `random`, `urandom`, and `tty`. The rootfs directory itself is never modified by a run.

**Process shape.** The process `bcdocker run …` on the host starts the container and waits. In the container, PID 1 is that same `bcdocker` program with its original command line; it starts the application as PID 2, forwards termination signals to it, reaps any orphaned processes, and exits with the application's status. When PID 1 exits, the kernel ends every process in the container.

**Application environment.** The application inherits stdin, stdout, and stderr, so terminal use and host-side redirection behave as with any command. It sees no other host file descriptors. Its environment is cleared except for `PATH` (the Debian default), `HOME=/root`, `HOSTNAME`, and `TERM` if the host set it.

**Exit status.** The host-side `bcdocker` exits with the application's exit code, or 128 plus the signal number if a signal ended it. It reserves three codes, as Docker does: 125 for a `bcdocker` setup failure, 126 for an application that exists but cannot be executed, 127 for an application that is not found. Ctrl-C reaches every process in the foreground group; the host-side `bcdocker` ignores `SIGINT` while it waits, and PID 1 forwards `SIGINT`, `SIGTERM`, and `SIGHUP` to the application.

**Failure modes.** Each ends with `bcdocker: <step>: <reason>` on stderr, from a typed error.

| Situation | Behavior |
|---|---|
| Not Linux | `bcdocker run` exits 125 saying it needs Linux namespaces; the macOS build otherwise works |
| Not root or missing privilege | exits 125 saying it needs root; under Docker, the message suggests `--privileged` |
| Container directory missing | exits 125 naming the path it looked for |
| Rootfs built for another architecture | exits 125 naming both architectures, instead of failing later with `Exec format error` |
| Application missing, or not executable | exits 127, or 126 |

**Building a rootfs.** `scripts/mkrootfs.sh <name>` creates `containers/<name>/` from `debian:bookworm-slim` for the machine's architecture, records that architecture in `containers/<name>/.arch`, and refuses to overwrite an existing directory. It uses Docker if available, otherwise crane. A VM without either installs one, or copies in a tarball made elsewhere.

**Out of scope.** Networking, cgroup limits, user namespaces, image pulling, overlayfs, a pseudo-terminal, and submission logistics.

**Verification.** Automated: the feature test builds a rootfs and checks PID 1 and PID 2, `/proc` contents, hostname isolation, filesystem isolation, and every exit code in the table. Manual: run it once on the `bookworm-slim` VM and once in privileged `bookworm-slim` on Docker Desktop, including Ctrl-C in an interactive shell.

## Alternatives

- **A. Path only, in-process.** `bcdocker run <rootfs-path> <app>`, no name resolution, no architecture stamp, no reserved exit codes. Simplest, but it differs from the assignment's command line, a wrong-architecture rootfs fails obscurely, and setup failures cannot be told apart from the application's own exit codes.
- **C. Named containers with metadata, `bcdocker mkrootfs`, re-exec init.** A `config.toml` per container, a Rust tar extractor, and PID 1 re-executing itself. Closest to real Docker, but it adds a tar crate and a TOML parser, drifts toward image pulling, and makes PID 1's command line differ from the sample unless copied over.

Approach B, described above, keeps A's small in-process launcher, matches the assignment's command line and sample output, and adds only the architecture stamp and reserved exit codes.

## Summary

**Deferred.** `clone3` for `CLONE_INTO_CGROUP` when cgroup limits arrive; `pivot_root` hardening in place of plain `chroot`; a pseudo-terminal; networking; image pulling.

### Open Artifact Decisions

**`containers/` and `$BCDOCKER_HOME`:** where named containers live and how to override it.
Proposed: `./containers/<name>/`, overridable by `BCDOCKER_HOME`, and `/containers` in `.gitignore`.

**`containers/<name>/.arch`:** how the architecture stamp is stored.
Proposed: a one-line file holding `uname -m` output (`x86_64` or `aarch64`), written by `mkrootfs.sh` and read before `clone`.

**`scripts/mkrootfs.sh`:** the rootfs builder's name and interface.
Proposed: `scripts/mkrootfs.sh <name>`, bash, preferring `docker export` and falling back to `crane export`.

**Exit codes 125, 126, 127:** reserved meanings.
Proposed: the Docker convention, documented in the README.

**Crate layout:** name and shape.
Proposed: one binary crate `bcdocker`, edition 2021 as in `uefi_boot`, `thiserror` 2 and `nix` 0.31 as the only dependencies, `Cargo.toml` and `Makefile` at the project root with `build` and `run` targets that branch on `uname -s` as `uefi_boot`'s do. `src/` holds the launcher, one `#[allow(unsafe_code)]` clone module under `#![deny(unsafe_code)]`, and the error enums.

**Test path:** `tests/run.rs`, the cargo integration-test convention, run with `sudo -E cargo test --test run`.
