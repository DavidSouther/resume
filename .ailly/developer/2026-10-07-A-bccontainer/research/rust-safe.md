# Safe-Rust container pipeline: clone / unshare / chroot / mount / exec / wait

Research date: 2026-10-07. Versions verified against crates.io API and the extracted `.crate` sources (not just rendered docs) [1].

## Findings

### 0. Scope note on the requirement

The course page [2] says "C or C++ or a language of your choice" and lists required behaviors (PID 1 in the container, separate filesystem, optional cgroup limits and network namespace). It does not name Rust, `unsafe`, `clone`, or `chroot`. The "safe Rust, using clone and chroot" constraint therefore comes from our project brief, not the page. That matters for how literally "clone" has to be read (see section 4).

### 1. Crate-by-crate safety table (current versions)

| Operation | nix 0.31.3 [3] | rustix 1.1.5 [4] | std (1.99 docs) [5][6] |
|---|---|---|---|
| `clone(2)` | `sched::clone` is **`unsafe fn`** (feature `sched`). Its Safety section covers stack overflow and the post-fork constraints of `fork` | **none** in the public API. `runtime::kernel_fork` is `unsafe`, `doc(hidden)`, and "experimental", for libc-replacement runtimes | none. `Command::spawn` uses `posix_spawn`/`pidfd_spawnp` or `fork` internally |
| `clone3(2)` | none | none | none publicly |
| `fork` | `unistd::fork` is **`unsafe fn`** | `runtime::kernel_fork` is `unsafe` | not exposed |
| `unshare(2)` | `sched::unshare(CloneFlags)` is **safe** | `thread::unshare` is **deprecated since 1.1.0**. `thread::unshare_unsafe` is **`unsafe fn`**, because `UnshareFlags::FILES` can split fd tables between threads | none |
| `setns(2)` | `sched::setns` is safe | `thread::move_into_link_name_space` / `move_into_thread_name_spaces` are safe | none |
| `chroot(2)` | `unistd::chroot` is safe (feature `fs`) | `process::chroot` is safe (feature `process`) | `std::os::unix::fs::chroot` is **safe and stable since 1.56**. `CommandExt::chroot` (runs in the child) is **nightly only**, `process_chroot` #141298 |
| `pivot_root(2)` | `unistd::pivot_root` is safe (Linux, feature `fs`) | `process::pivot_root` is safe (Linux) | none |
| `mount`/`umount2` | `mount::mount`, `umount`, `umount2` are safe (feature `mount`) | `mount::mount`, `mount_bind`, `mount_change`, `mount_remount`, `unmount`, `fsopen`/`fsmount`/`move_mount` are safe (feature `mount`) | none |
| `sethostname` | `unistd::sethostname` is safe (feature `hostname`) | `system::sethostname` is safe (feature `system`) | none |
| `execve` | `unistd::execve`, `execv`, `execvp`, `execvpe`, `fexecve` are safe (feature `process`) | `runtime::execve` is `unsafe` (raw pointers) | `CommandExt::exec` is safe, stable since 1.9 |
| `waitpid` | `sys::wait::waitpid` / `wait` are safe (feature `process`) | `process::waitpid` / `wait` / `waitid` are safe | `Child::wait` is safe |
| pre-exec hook | n/a | n/a | `CommandExt::pre_exec` is **`unsafe`** (stable 1.34) and must be async-signal-safe |

A crate's "safe" label reflects its own judgement, not a law. nix keeps `unshare` safe, while rustix decided that the same syscall is unsound with `CLONE_FILES` and made it `unsafe` [4]. For our purposes the nix path is safe at the type-system level, and we never pass `CLONE_FILES`.

### 2. Other crates surveyed

- **libc 0.2.190**: every function is an `unsafe extern` declaration, so it is useless under `forbid(unsafe_code)` [1].
- **clone3 0.2.3** (last release Dec 2022): `Clone3::call()` and `call_unchecked()` are `unsafe fn`. The crate docs say "This is a complex and generally unsafe operation" [7].
- **unshare 0.7.0** (last release May 2021, depends on nix 0.20): offers a **safe** `std::process::Command`-like builder with `.unshare(&[Namespace::Pid, ...])`, `.chroot_dir()`, `.pivot_root()`, `.set_id_maps()`, and `.spawn()`. It does `nix::sched::clone` + `child_after_clone` internally. This is the only crate found that gives safe "clone with namespaces + chroot". It is unmaintained (5 years old, pins old nix and libc), and its `pre_exec` is `unsafe`. It is usable, but its age and the transitive dependency risk are real, and it hides exactly the mechanism the course wants us to demonstrate [8].
- **birdcage 0.8.1** (phylum, Apr 2024): a sandbox and not a container runtime. Internally it calls raw `libc::clone`, `libc::mount`, `SYS_pivot_root`, and `libc::unshare` inside `unsafe` blocks. It shows how a library is built, but it is not a safe API for our needs [9].
- **youki / libcontainer 0.7.0** (Jul 2026): `process/fork.rs` tries raw `syscall(SYS_clone3, …)` first and falls back to `libc::clone` with an `mmap`'d, guard-paged stack. Both run in `unsafe` blocks, and the crate has dozens of `unsafe` sites (most in `syscall/linux.rs`). It uses nix 0.29 safe wrappers for mount, pivot_root, sethostname, and so on. This is the production pattern: **one small audited unsafe clone module, with safe nix wrappers everywhere else** [10].

### 3. The two pipelines and their precise semantics

#### A. Raw clone (unsafe)

```
clone(child_fn, stack, CLONE_NEWPID|CLONE_NEWNS|CLONE_NEWUTS|SIGCHLD)  // nix::sched::clone: unsafe
  child (PID 1 in new ns): mount --make-rprivate /, mount proc, sethostname, chroot, chdir, execve
  parent: waitpid(child)
```

- The child is born in all the new namespaces at once. The parent's own namespaces never change.
- The child closure runs between clone and exec in a forked copy of a possibly multithreaded address space. That is why nix marks it `unsafe` (stack sizing, and async-signal-safety per the `fork` Safety text [3]).
- This needs at least one `unsafe` block in our crate.

#### B. unshare + std::process::Command, with a self re-exec (all safe in our code)

```
parent:  nix::sched::unshare(CLONE_NEWPID|CLONE_NEWNS|CLONE_NEWUTS)          // safe
         Command::new("/proc/self/exe").arg("__init").args(...).spawn()      // safe
         child.wait()                                                        // safe
__init (PID 1 in the new PID ns, same new mnt/uts ns as the parent):
         mount(None,"/",None,MS_REC|MS_PRIVATE,None)                         // nix, safe
         sethostname(..)                                                     // nix, safe
         mount("proc", rootfs/proc, "proc", ..)                              // nix, safe
         chroot(rootfs) ; set_current_dir("/")                               // std, safe
         Command::new(cmd).args(..).exec()  // or nix::unistd::execve        // safe; stays PID 1
```

Exact semantic differences from A, each from the man pages:

1. **The caller does not enter the new PID namespace.** "The calling process is *not* moved into the new namespace. The first child created by the calling process will have the process ID 1" [11]. pid_namespaces(7) says these calls "do not … change the PID namespace of the calling process" [12]. The spawned child is PID 1, which meets the requirement.
2. **Mount and UTS namespaces *do* move the caller.** After `unshare(CLONE_NEWNS|CLONE_NEWUTS)` the runtime parent itself lives in the new mount and UTS namespaces. That is harmless for a one-shot CLI, but the parent's own `mount` and `sethostname` calls now affect the container. Also, on hosts where `/` is a shared mount (systemd), you must `MS_REC|MS_PRIVATE` `/` first so mounts do not propagate back to the host.
3. **The parent can no longer create threads.** clone(2) returns EINVAL when "CLONE_THREAD was specified … but the current process previously called unshare(2) with the CLONE_NEWPID flag" [13]. So after the unshare, `std::thread::spawn`, tokio, and similar fail in the parent. Do the unshare as late as possible in a single-threaded `main`.
4. **There is only one init child.** If the first child exits, "subsequent calls to fork(2) fail with ENOMEM" [12]. You cannot spawn a second container from the same parent after the first one dies (use a fresh process per container, or setns).
5. **`/proc` must be mounted by the child.** "A /proc filesystem shows … only processes visible in the PID namespace of the process that performed the mount" [12]. If the parent mounts proc, it shows *host* PIDs, so the mount belongs in the re-exec'd `__init`. This is why a plain `Command` without a re-exec (or without `unsafe pre_exec`) is not enough: std has no safe hook that runs code in the child before exec except the nightly `chroot`/`setsid`.
6. **Signals to PID 1.** The re-exec'd init, or the exec'd program, is init. Only signals it has handlers for are delivered from inside the namespace [12]. This matters for Ctrl-C handling, and it is the same in pipelines A and B.
7. **`CLONE_NEWUSER` needs a single-threaded process** [11]. Rootless user namespaces fit B only if the parent is single-threaded and writes `uid_map`/`gid_map` for the child, which needs a sync pipe. Out of scope for the minimum.
8. **Under the hood, B still uses `clone`.** std spawns via glibc `posix_spawn` or `pidfd_spawnp` (clone with `CLONE_VM|CLONE_VFORK`) or `fork` [14]. Our crate never calls `clone(2)` by name, though.

### 4. Where `#![forbid(unsafe_code)]` is feasible

- **Pipeline B works with a crate-wide `#![forbid(unsafe_code)]`.** It uses nix (`sched`, `mount`, `hostname`, `fs`, `process` features) plus std. `forbid` only covers our crate; the unsafe inside nix and std is the trusted base, as with any Rust program. Watch for two pitfalls. First, in edition 2024 `std::env::set_var` and `remove_var` are `unsafe`, so set the container environment with `Command::env`/`env_clear` instead. Second, `pre_exec` is out.
- **If "using clone" must literally mean calling `clone(2)`**, forbid at the crate root is impossible. Two options:
  - (a) `#![deny(unsafe_code)]` at the root, plus one `#[allow(unsafe_code)] mod sys_clone` (~30 lines) wrapping `nix::sched::clone`. Give it a `// SAFETY:` justification: a single-threaded caller, an 8 MiB heap stack, and a child closure that only calls nix syscall wrappers before `execve`. This mirrors youki's design [10]. Alternatively, split it into a workspace crate `bccontainer-sys` (unsafe allowed) and a `bccontainer` binary crate with `forbid`.
  - (b) Use the `unshare` crate's safe `Command`, which keeps `forbid` in our crate but adds an unmaintained dependency that calls `clone` for us [8].
- Recommendation: build pipeline B as the "SAFE Rust" deliverable and present the unshare-vs-clone semantics (points 1-5) in the slides. Keep option (a) behind a cargo feature only if the grader insists that `clone` appear in our code.

### 5. Environment caveat (Docker on Mac)

Docker's default seccomp profile blocks namespace-creating `clone`, `unshare`, `mount`, `umount2`, `pivot_root`, and `setns`, and gates them on `CAP_SYS_ADMIN` [15]. The bookworm-slim container must run with `--privileged`, or at least `--cap-add SYS_ADMIN --security-opt seccomp=unconfined --security-opt apparmor=unconfined`. The Debian VM runs as root without that restriction.

## Unresolved

- Whether the instructor reads "use clone" literally. The page does not say [2].
- glibc 2.36 (bookworm) `posix_spawn` internally tries `clone3` and then falls back to `clone`. This is believed but not verified here, and it is not load-bearing.
- The `unshare` crate (nix 0.20) was not compile-tested on a current toolchain.

## Sources

[1] crates.io, "Crate API: nix, rustix, libc, clone3, unshare, birdcage, libcontainer," https://crates.io/api/v1/crates/{name}, accessed Oct. 7, 2026. Sources extracted from `static.crates.io/crates/{name}/{name}-{ver}.crate`.
[2] H. Chen, "Project 2: Application Container (bccontainer)," CISC 7310X, Fall 2026. https://huichen-cs.github.io/course/CISC7310X/26FA/assignment/bccontainer
[3] nix-rust, "nix 0.31.3: src/sched.rs, src/unistd.rs, src/mount/linux.rs, src/sys/wait.rs," docs.rs. https://docs.rs/nix/0.31.3/nix/
[4] bytecodealliance, "rustix 1.1.5: src/thread/setns.rs, src/process/{chroot,pivot_root,wait}.rs, src/mount/mount_unmount.rs, src/system.rs, src/runtime_*.rs," docs.rs. https://docs.rs/rustix/1.1.5/rustix/
[5] The Rust Project, "Trait std::os::unix::process::CommandExt," Rust 1.99 docs. https://doc.rust-lang.org/std/os/unix/process/trait.CommandExt.html
[6] The Rust Project, "Function std::os::unix::fs::chroot," https://doc.rust-lang.org/std/os/unix/fs/fn.chroot.html
[7] "clone3 0.2.3," docs.rs. https://docs.rs/clone3/0.2.3/clone3/
[8] P. Colomiets, "unshare 0.7.0," docs.rs. https://docs.rs/unshare/0.7.0/unshare/
[9] Phylum, "birdcage 0.8.1: src/linux/{mod,namespaces}.rs," https://docs.rs/birdcage/0.8.1/ ; https://github.com/phylum-dev/birdcage
[10] youki-dev, "libcontainer 0.7.0: src/process/fork.rs," https://docs.rs/libcontainer/0.7.0/ ; https://github.com/youki-dev/youki
[11] M. Kerrisk, "unshare(2)," Linux man-pages. https://man7.org/linux/man-pages/man2/unshare.2.html
[12] M. Kerrisk, "pid_namespaces(7)," Linux man-pages. https://man7.org/linux/man-pages/man7/pid_namespaces.7.html
[13] M. Kerrisk, "clone(2)," Linux man-pages. https://man7.org/linux/man-pages/man2/clone.2.html
[14] The Rust Project, "library/std/src/sys/process/unix/unix.rs," rust-lang/rust main. https://github.com/rust-lang/rust/blob/main/library/std/src/sys/process/unix/unix.rs
[15] Docker Inc., "Seccomp security profiles for Docker." https://docs.docker.com/engine/security/seccomp/
