# Public: clone vs clone3, flags, CLONE_IO

## Findings

**clone3 is newer, not required.** `clone3()` arrived in Linux 5.3. It takes a `struct clone_args` plus a size, with 64-bit `flags`, an explicit `stack`/`stack_size`, `exit_signal`, `set_tid` (5.5+) and `cgroup` (5.7+) [1]. glibc provides no wrapper, so a caller must use `syscall(2)` [1][2]. `clone()` has a glibc wrapper [2].

**Debian bookworm ships kernel 6.1**, so clone3 exists on the VM target. Docker Desktop's Linux VM is newer still. Availability is not the constraint. Seccomp is.

**Docker's default seccomp profile is the practical blocker.**
- `clone`: "Deny cloning new namespaces. Also gated by CAP_SYS_ADMIN for CLONE_* flags, except CLONE_NEWUSER." [3]
- `unshare`, `mount`, `pivot_root`: denied or gated by `CAP_SYS_ADMIN` [3].
- Seccomp cannot inspect flags inside `clone_args`, so Moby makes `clone3` return `ENOSYS`, which makes glibc fall back to `clone`, where flags can be filtered [4].
- Consequence: inside Docker, `clone3` is the wrong first choice. Either profile returns an error without extra privilege. Run the container with `--security-opt seccomp=unconfined` plus `--cap-add SYS_ADMIN`, or `--privileged` [3].

**Recommendation: use `clone` first.** It has a library wrapper, it is filterable, and it behaves the same under Docker's fallback logic. Revisit `clone3` only for `CLONE_INTO_CGROUP` or `CLONE_PIDFD` when cgroups are added.

**CLONE_IO is not what the project needs.** The man page: the child "shares an I/O context with the calling process", where the I/O context is "the I/O scope of the disk scheduler" [5]. It affects block-layer scheduling for threads doing I/O on behalf of one process. It does not isolate anything, and it does not redirect stdin, stdout or stderr. Start with the namespace flags instead.

**Starting flag set** (network deferred):

| Flag | Purpose |
|---|---|
| `CLONE_NEWPID` | child is PID 1 [6] |
| `CLONE_NEWNS` | private mount table, so `/proc` and the rootfs mounts do not leak |
| `CLONE_NEWUTS` | per-container hostname |
| `CLONE_NEWIPC` | isolated SysV IPC and POSIX queues |
| `SIGCHLD` (exit signal) | lets the parent `waitpid` the child |

Later or optional: `CLONE_NEWCGROUP`, `CLONE_NEWUSER` (needs `CLONE_FS` unset; incompatible with `CLONE_THREAD`/`CLONE_PARENT` [1]), `CLONE_NEWNET` (deferred by request).

**PID 1 duties.** The first process in the namespace is init. Signals without a handler from inside the namespace are ignored; SIGKILL and SIGSTOP from an ancestor namespace still work. Orphans reparent to it. If it exits, the kernel SIGKILLs the whole namespace, and later `fork` into it fails with `ENOMEM` [6]. The child should also mount a fresh `/proc` so `ps` agrees with the namespace [6].

**Rust API.** `nix::sched::clone` (nix 0.31.3) is `pub unsafe fn clone(cb, stack: &mut [u8], flags, signal) -> Result<Pid>`. The stack overflow risk is the caller's [7]. `rustix` 1.1.5 exposes `chroot` and `pivot_root` under the `fs` feature, but no `clone` or `unshare` in `rustix::process` [8]. See `rust-safe.md` for the full safe-Rust survey.

## Sources

- [1] M. Kerrisk et al. "clone3(2)." Debian manpages, unstable. [Online]. Available: https://manpages.debian.org/unstable/manpages-dev/clone3.2.en.html
- [2] Debian. "clone(2)." manpages-dev, testing. [Online]. Available: https://manpages.debian.org/testing/manpages-dev/clone.2.en.html
- [3] Docker. "Seccomp security profiles for Docker." [Online]. Available: https://docs.docker.com/engine/security/seccomp/
- [4] Moby. "seccomp: add support for clone3 syscall in default policy." [Online]. Available: https://git.causa-arcana.com/kotovalexarian-likes-github/moby--moby/commit/9f6b562dd12ef7b1f9e2f8e6f2ab6477790a6594
- [5] M. Kerrisk. "clone(2) - Linux man page." [Online]. Available: https://linux.die.net/man/2/clone
- [6] M. Kerrisk. "pid_namespaces(7)." man7.org. [Online]. Available: https://man7.org/linux/man-pages/man7/pid_namespaces.7.html
- [7] nix-rust. "Function nix::sched::clone." docs.rs, v0.31.3. [Online]. Available: https://docs.rs/nix/latest/nix/sched/fn.clone.html
- [8] bytecodealliance. "Module rustix::process." docs.rs, v1.1.5. [Online]. Available: https://docs.rs/rustix/latest/rustix/process/index.html
