# bcdocker

A small container launcher for CISC 7310X. It runs a program in new PID, mount, UTS, and IPC namespaces with a `chroot` and a fresh `/proc`, using one audited `unsafe` call (`clone`).

```
bcdocker run [--stack-size <size>] <container> <app> [args...]
```

Inside a container, `bcdocker` is PID 1 and the application is PID 2. The container's hostname is its directory name, and only its own processes appear in `/proc`. The host-side command exits with the application's status, or 128 plus a signal number.

## Requirements

- A Linux kernel and root. `bcdocker` builds on macOS but declines to run there.
- Rust 1.96 or newer.
- Docker (with a reachable daemon) or `crane`, to extract a root filesystem.

On a Mac, run `./linux`. It builds [Dockerfile](Dockerfile) (`debian:stable-slim` with Rust, strace, and procps), makes the `tinysys` and `psstat` container roots on the host if they are missing, and opens a privileged shell in `/work/bccontainer` with `..` mounted. The rustup and cargo directories are named Docker volumes (`bcdocker-rustup`, `bcdocker-cargo`), so the toolchain and crates download once. Everything below then runs in that shell, as root, so drop `sudo`. `./linux cargo build` runs a single command instead. Without `--privileged`, `clone` fails with `EPERM` and the error message says so.

## Build and run

```sh
cargo build
scripts/mkrootfs.sh tinysys              # extracts debian:bookworm-slim to ./containers/tinysys
sudo target/debug/bcdocker run tinysys /bin/sh
```

In that shell, `echo $$` prints `2`, `cat /proc/sys/kernel/hostname` prints `tinysys`, and `exit 3` makes `echo $?` print `3` on the host. `scripts/mkrootfs.sh <name> [image]` accepts another image as a second argument. The name must be 1 to 64 bytes, not `.` or `..`, and contain no `/`. `./containers` is ignored by git.

`mkrootfs.sh` also installs `../psstat/psstat.sh` as `/usr/local/bin/psstat.sh` in every root filesystem it makes.

## The psstat experiment

This runs `../psstat/psstat.sh` under strace in a `bcdocker` container and collects traces for the questions in [../psstat/ANSWERS.md](../psstat/ANSWERS.md). The container's PID namespace is small, so output is easy to read: PID 1 is `bcdocker` and PID 2 is the first application.

### 1. Automated check

```sh
cargo build && sudo scripts/psstat.sh
```

This builds a `bctest` container under `target/test-work/`, runs every `psstat.sh` option in it, and prints `ok` or one `FAIL:` line per problem.

### 2. Trace run

On a Mac, one command does everything:

```sh
scripts/psstat-answers.sh
```

It calls `./linux` first, which builds the dev image and container roots, then runs `scripts/psstat-run.sh` in the dev container. That script builds `bcdocker`, copies a fresh `../psstat` into the `psstat` container root, runs `/bin/sh /psstat/questions.sh` as the application of `bcdocker run psstat`, shows its output as it runs, and writes `run.log`, `traces/`, and a generated `ANSWERS.md` here. It never touches `../psstat/ANSWERS.md`.

On a Linux host with Docker, the same command works. To skip Docker for the dev environment, make the root yourself and run the inner script as root:

```sh
docker build -t debian-ps ../psstat
scripts/mkrootfs.sh psstat debian-ps
sudo scripts/psstat-run.sh
```

`questions.sh` needs strace and ps, which `debian:bookworm-slim` lacks, so the root comes from `../psstat/Dockerfile`. A local image only works with Docker, since `crane` pulls from a registry. `questions.sh` starts a background `yes` through `my (yes) sh`, then:

| Command in `questions.sh` | Trace or output | Question |
|---|---|---|
| `strace -f ./psstat.sh --list-short` | `traces/list-short` | read syscall count |
| `strace -f ./psstat.sh --list-sched-policy-is 0` | `traces/list-shed-policy` | scheduling policy |
| `ps -eo pid,stat,comm,args` and `./psstat.sh --list-long` | `run.log` | comparison with `ps` |
| `./psstat.sh --list-pid-is -10` | `run.log` | `No such file or directory` |
| `su -s /bin/bash nobody -c './psstat.sh --list-pid-is 1 ; cat /proc/1/environ'` | `run.log` | permission failure |

Differences from the original recorded run (a Docker container with `bash` as PID 1): PID 1 is `bcdocker`, PIDs are small and contiguous until processes exit, and `--list-long` lists `bcdocker` first.

For an interactive session instead, run `./linux`, then:

```sh
target/debug/bcdocker run psstat /bin/bash
cd /psstat
strace -f -o /tmp/t ./psstat.sh --list-short
```

### 3. Write-up

`ANSWERS.md` here is evidence: for each question with a measurable answer, it quotes the question and shows the matching trace excerpt, with a computed `/proc` read count. Prose answers stay in [../psstat/ANSWERS.md](../psstat/ANSWERS.md), and the design note in [../psstat/README.md](../psstat/README.md). To update them from a new run:

1. Read the `/proc` read count and per-path breakdown for `--list-short`. A `getdents64` on the `/proc` directory descriptor is not a `read`, and bash reads `/proc/filesystems` on start.
2. In the `su nobody` output, find the failing syscall and errno for a `0400` file such as `/proc/1/environ`. `/proc/1/stat` is `0444`, so `nobody` can read it.
3. Compare `ps -eo pid,stat,comm,args` with `--list-long`. Name at least three differences and the `/proc` file each comes from (`stat`, `cmdline`, `status`).
4. Copy excerpts you cite into `../psstat/answers.out`, and quote them in `../psstat/ANSWERS.md`.

## Tests

All tests need root on Linux and a built binary. `BCDOCKER` overrides the binary under test.

| Command | Checks |
|---|---|
| `sudo scripts/run.sh` | Feature test: PID 1 and 2, hostname, filesystem isolation, no leftover mounts, exit status, failure messages |
| `sudo scripts/hardening.sh` | `/dev` devices, inherited descriptors, `PATH`, orphan reaping, parent death |
| `sudo scripts/psstat.sh` | Every `psstat.sh` option inside a container |
| `sudo scripts/stack.sh` | Stack depth of the cloned child stays under 64 KiB |
| `scripts/mkrootfs_test.sh` | `scripts/mkrootfs.sh` argument and name handling |

Tests build `target/test-work/containers/bctest` on first use and reuse it.

## Layout

| Path | Purpose |
|---|---|
| `src/cli.rs` | Argument parsing |
| `src/container.rs` | Container name and path resolution |
| `src/clone.rs` | The only `unsafe` code: `clone` with namespace flags on a heap stack |
| `src/launch.rs`, `src/supervise.rs` | Host side and PID 1 side |
| `src/sandbox.rs` | Mounts, `/dev`, `chroot`, `/proc` |
| `src/stack.rs`, `src/status.rs`, `src/error.rs` | Stack size, exit status, typed errors |
| `scripts/mkrootfs.sh` | Root filesystem extraction |
| `scripts/psstat-answers.sh`, `scripts/psstat-run.sh` | Entry point that calls `./linux`, and the step it runs in the dev container to execute `questions.sh` and write `ANSWERS.md` |
| `Dockerfile`, `linux` | Dev image and launcher for non-Linux hosts |

## Troubleshooting

- `privilege: bcdocker needs root`: run with `sudo`, or `--privileged` under Docker.
- `mkrootfs: ... exists`: remove `containers/<name>` or choose another name.
- `mkrootfs: install docker or crane`: neither tool is on `PATH`, or the Docker daemon is not running.
- `strace: ptrace(...): Operation not permitted`: the outer Docker container is missing `--privileged`.
