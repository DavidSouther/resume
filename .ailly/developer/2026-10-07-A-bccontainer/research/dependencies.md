# research:dependencies — Rust crates for a namespace container launcher

*2026-10-07. Versions from the crates.io API; signatures and feature gates from docs.rs.*

| Crate | Latest stable | Role |
|---|---|---|
| `nix` | 0.31.3 (2026-05-11) | Safe wrappers: `sched::{clone, unshare, CloneFlags}` (feature `sched`), `mount::{mount, umount2, MsFlags}` (feature `mount`), `unistd::{chroot, pivot_root, chdir, fork, execvp, sethostname}` (features `fs`, `process`, `hostname`), `sys::wait::waitpid` (feature `process`/`signal`) [1]–[3] |
| `libc` | 0.2.190 (2026-10-02) | Raw fallback for anything nix does not wrap [4] |
| `caps` | 0.5.6 | Linux capabilities. Not needed: the assignment runs under `sudo` [5] |

Notes:

- `nix::sched::clone` is `pub unsafe fn clone(cb: CloneCb<'_>, stack: &mut [u8], flags: CloneFlags, signal: Option<c_int>) -> Result<Pid>`. "Unlike when calling clone(2) from C, the provided stack address need not be the highest address of the region. Nix will take care of that requirement." Safety: the caller must keep the child within the stack and observe `fork` safety rules [1].
- Alternative shape with no manual stack: `unshare(CLONE_NEWPID | CLONE_NEWUTS | CLONE_NEWNS)` then `fork()`; per pid_namespaces(7) the *child* of the unsharing process becomes PID 1, the caller does not move.
- `nix::sched` (clone/unshare/setns), `nix::mount::mount` and `pivot_root` exist only on Linux/Android targets; on macOS the crate exposes `chroot` but not these. Code that must also compile on macOS needs `#[cfg(target_os = "linux")]` gating.
- Single-threaded before `clone`/`fork` keeps the post-fork child safe (no locks held by other threads); avoid spawning threads before the launch.
- No crate ships an agentic skill (`SKILL.md`, MCP server). Searched docs.rs pages and repos of nix/libc/caps; none found.

## Sources

[1] nix-rust, "Function nix::sched::clone," docs.rs, v0.31.3. [Online]. Available: https://docs.rs/nix/latest/nix/sched/fn.clone.html

[2] nix-rust, "Function nix::mount::mount," docs.rs. [Online]. Available: https://docs.rs/nix/latest/nix/mount/fn.mount.html

[3] nix-rust, "Module nix::unistd," docs.rs. [Online]. Available: https://docs.rs/nix/latest/nix/unistd/index.html

[4] rust-lang, "libc," crates.io. [Online]. Available: https://crates.io/crates/libc

[5] lucab, "caps," crates.io. [Online]. Available: https://crates.io/crates/caps
