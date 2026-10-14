# Clean comments re-review: bccontainer (bcdocker)

Skill: clean-comments-review. Scope: every comment in `pages/course/cisc_7310/bccontainer/` outside `target/`: `src/*.rs`, `Cargo.toml`, `scripts/mkrootfs.sh`, `tests/*.sh`. Written independently, without reading earlier reviews.

## Verification performed

Root shell, x86_64, glibc 2.39 (Ubuntu), rustc 1.97.0, kernel 6.18.

| Claim | Where | Result |
|---|---|---|
| nix 0.31.3 `clone` computes `end - end % 16`, ORs `signal` into flags, passes `&mut cb`, no ptid/tls/ctid; `callback` is `extern "C"` | clone.rs:116-119, C3, C5 | Matches `~/.cargo/registry/.../nix-0.31.3/src/sched.rs:107-137` |
| nix `# Safety` text (stack overflow; fork restrictions) | C1, C2 | Matches sched.rs:98-106, unistd.rs:266-276 |
| `CloneFlags` cannot name SETTLS, *_SETTID, CHILD_CLEARTID, PIDFD | clone.rs:91-92, 235-236, E1 | True: commented out or absent in sched.rs:55-68 |
| "When the fn(arg) function returns, the child process terminates" | E2 | Verbatim from clone(2) (man7.org) |
| CLONE_FS + CLONE_NEWNS and CLONE_THREAD + CLONE_NEWPID give EINVAL | clone.rs:85-87 | Confirmed empirically (ctypes `clone`: EINVAL both) |
| CLONE_PARENT + CLONE_NEWPID: child belongs to bcdocker's parent | clone.rs:87-88 | Confirmed: kernel 6.18 accepts it, and `waitpid` gives ECHILD. clone(2) still lists that combination as EINVAL, so the comment correctly avoids citing the man page here |
| CLONE_IO semantics | clone.rs:89-90 | Accurate per clone(2) |
| SIGCHLD = 17, inside CSIGNAL 0xff | E1 | True |
| E5(b): 16 KiB debug, 12-16 KiB release; same at 8M and 1M; 2000 args + 100 KB env same in debug, +1 page in release | clone.rs:163-169 | Reproduced exactly, 3 runs each of `tests/stack.sh` on debug and release: debug 16/16/16, release 12/12/16 |
| 64x and 512x; 64 KiB = MIN/16 = 4x debug | E5(b)(c), stack.sh:8,21 | Arithmetic correct |
| stack.sh "+1 page above the pointer for the frames above it" | stack.sh:37-38 | Holds today: sp at the wait is about 1.6 KiB (debug) and 0.5 KiB (release) below the stack top (measured from `/proc/<pid1>/maps`; the block is in `[heap]` under the 128 KiB top pad) |
| `tty` reports "not a tty" | sandbox.rs:31-32 | Confirmed with a real pty on stdin (`script -qec`) |
| mkrootfs `$(LC_ALL=C; echo ${#name})` counts bytes | mkrootfs.sh:21 | Confirmed under `LC_ALL=C.UTF-8`: 33 chars, 66 bytes |
| Rust >= 1.81 aborts on unwind out of `extern "C"` | E6 | True |
| Kernel hostname limit 64 bytes | container.rs:14 | True (`__NEW_UTS_LEN`) |
| Every top-level leaf message starts with its step | error.rs:1-2 | True for all variants in cli, stack, container, clone, launch |
| No `#[global_allocator]` | I5 | True (only mention is the comment) |
| Test claims in comments | tests/*.sh | `cargo test` (28 pass), `run.sh`, `hardening.sh`, `mkrootfs_test.sh`, `stack.sh` all print `ok` |

No comment names a function, label, file or number that no longer exists. The cross-references I1-I5, A1, C1-C6 and E1-E6 all resolve. I found no history breadcrumbs, plan-step or review-finding references, design-doc links, or TODO prose in any comment.

## Findings by severity

### High

None.

### Medium

**M1. clone.rs:160-162 (E5(a)) overstates input independence and contradicts E5(b).**
- Audience: internal maintainer (safety argument).
- Durable intent: the stack depth is bounded by code shape (no recursion, no large locals, variable-size data on the heap), not proportional to the input.
- Assessment: "so the stack depth does not depend on the input" is falsified by E5(b) six lines later, and by the measurement: the release build goes one page deeper (12 to 16 KiB) with 2000 arguments and a 100 KB environment. Large inputs probably take a different allocator or libc path. A safety argument that disagrees with its own evidence invites a reader to distrust both.
- Action: rewrite around the invariant. Say the depth does not *grow with* input size: variable-size data is on the heap, so input changes only which bounded code path runs (one page in release, per (b)).

**M2. stack.rs:5-6 (`MIN` doc) implies the stack test tracks `MIN`. It does not.**
- Audience: internal maintainer about to change the constant.
- Durable intent: lowering `MIN` weakens A1, and `tests/stack.sh`'s limit is pinned to `MIN / 16`.
- Assessment: "`tests/stack.sh` fails at `MIN / 16`" reads as if the script derives its threshold from `MIN`. It hard-codes `limit_kb=${LIMIT_KB:-64}` (stack.sh:21), and E5(c) also writes "64 KiB". If `MIN` changes, the doc, E5(b)(c), stack.sh:8 and stack.sh:21 all drift silently. Also, the script fails *above* the limit, not *at* it.
- Action: rewrite around the invariant. For example: "`tests/stack.sh` hard-codes `MIN / 16` (64 KiB) as its limit; change it, and the figures in E5, with this constant."

### Low

**L1. clone.rs:89-90 (`CLONE_IO`): "and does not redirect stdin, stdout, or stderr."**
This answers a misconception no reader of the code raises, and it reads like a reply to a past question. Action: reduce to intent: "shares the disk scheduler's I/O context; it isolates nothing."

**L2. clone.rs:77-92 ("Left out on purpose") is not exhaustive, but its framing suggests it is.**
nix can also name `CLONE_VFORK`, `CLONE_PTRACE`, `CLONE_UNTRACED` and `CLONE_SYSVSEM`. `CLONE_SYSVSEM` is notable because it shares state with the parent (and is EINVAL with `CLONE_NEWIPC`). The test pins `CLONE_FLAGS` exactly, so this is not a soundness gap. Action: add one line, "every other flag is left out; the ones worth explaining are:", or list `CLONE_SYSVSEM`/`CLONE_VFORK`.

**L3. clone.rs:12 (I1) and 145-146 (E3): "one `ReadDir` drop" / "(glibc `free`, I5)".**
Dropping a `ReadDir` is `closedir`: a `close(2)` plus `free`, plus an `Arc` decrement. The conclusion still holds (none of these creates a thread), but the evidence names only `free`. Action: say "`closedir` (a `close` and a glibc `free`)".

**L4. clone.rs:6-8 (module doc): the audit was read against glibc 2.36, but it runs and was measured on 2.39.**
E3's glibc-internal claims (no atfork handlers in `clone()`, the stale cached TID, `raise`/`abort` using `gettid`) are version-sensitive. The doc says which version was read but not that these are the items to re-read on a glibc upgrade. Action: keep it, and add "re-read the E3 glibc claims on upgrade", matching what E5 already says for the stack.

**L5. clone.rs:178 (E6): "and Cargo.toml has `rust-version = "1.96"`".**
This quotes another file's literal value, so it drifts on every MSRV bump, although the needed fact (>= 1.81) would stay true. Action: reduce to "Cargo.toml's `rust-version` is >= 1.81".

**L6. clone.rs:98-110 (`spawn` doc) restates E2 at length.**
Lines 104-107 (copy of memory, closure valid and never dropped in the child, dropped once here) repeat E2 and the Postconditions. The caller contract is: given A1, the call is sound for every safe caller; it fails without cloning unless single-threaded; reap the pid; do not hold a std lock the child takes; the exit status is truncated to 8 bits. Action: reduce to that contract and leave the memory argument to the SAFETY block. The list of four namespaces in the first sentence also duplicates `CLONE_FLAGS`. The test pins those flags, so this one is tolerable.

**L7. clone.rs:140: over-width line** ("...never frees them. Writes in either process are invisible to the other, so the", 103 columns, where the rest of the block wraps at about 96). This looks like an edit residue. Action: re-wrap.

**L8. clone.rs:198 and 202: inline comments repeat the `only_thread` doc.**
The doc already says "Any other outcome, including I/O errors, is `Err`." Action: remove both trailing comments, or keep one.

**L9. stack.rs:62-64 (`allocate` doc): "`vec!` then gets the same space" and "committed only when touched".**
"The same space" is an allocator behavior, not a guarantee. "Commit" is used in two senses: commit-limit accounting in the first sentence and physical residency in the second. The real intent is that a probe turns an unallocatable size into `Alloc` instead of an abort, and that the zeroed allocation leaves untouched pages unbacked, which `tests/stack.sh` relies on. Action: rewrite around that intent and say "backed by physical pages only when touched". Note that the probe narrows but does not close the abort window.

**L10. supervise.rs:43-47: the `supervise` doc covers only the parent-death signal.**
The text is accurate and valuable (I1 coupling, the parent pid reads 0 in a new PID namespace), but it explains line 49, not the function. Action: move it to an inline comment above `set_pdeathsig`. Give `supervise` a one-line intent, or none.

**L11. supervise.rs:70-71 vs 88-92: the `open_fds_above` contract omits that the listing fd itself is in the result.**
The caller's doc carries this ("its number then gives `EBADF`, which is ignored"), so the callee's contract is incomplete. Action: in `open_fds_above`, say the result can include the directory handle's own, already-closed, number.

**L12. cli.rs:1 and 29-30: the usage synopsis appears twice in comments**, and twice more in the `Error` strings. Action: keep the synopsis in the module doc. Reduce the `parse` doc to the parsing rule: options precede the container, and everything after the app belongs to the app.

**L13. sandbox.rs:83-85: "(after the bind mount, so this is the bind mount)" is hard to parse.**
The invariant is that `chdir(root)` must follow the self bind mount so that the new root is the bind mount. Action: rewrite that clause. Keep the closing limitation ("a nested chroot climbs back out"): it is durable and honest.

**L14. scripts/mkrootfs.sh:27: "Docker and crane both need the platform spelled out: crane defaults to linux/amd64."**
Only the crane half is a default. Docker defaults to the daemon's platform and can reuse a cached image of another platform. Action: say "so both fetch this machine's architecture: crane defaults to linux/amd64, and docker may reuse a cached image of another platform."

**L15. scripts/mkrootfs.sh:21: missing comment for `$(LC_ALL=C; echo ${#name})`.**
This surprising construct is what makes the check count bytes, not characters, to match the kernel and `Hostname::parse`. Verified to work. Action: add "bytes, not characters" next to it, or fold it into line 20.

**L16. tests/run.sh:63: the comment's second clause belongs at line 70.**
"...and setup left the rootfs's /proc an empty directory" is checked seven lines later, after the shared-propagation block. Action: move that clause to sit above line 70.

**L17. tests/stack.sh:37-38: "plus one page above the pointer for the frames above it" is an unstated assumption.**
It holds today (about 1.6 KiB debug, 0.5 KiB release between sp and the stack top), but nothing checks it. Action: label it as an assumption (the frames above the waiting `waitpid` fit in one page).

**L18. tests/stack.sh:13-14: "so test the debug build too."**
The default binary *is* the debug build, so "too" reads backwards. Action: "The default is the debug build, which uses more stack; set BCDOCKER to check release as well."

**L19. tests/hardening.sh:7: "Shares target/test-work with run.sh".**
`stack.sh` shares it as well, and naming one sibling is usage-site prose. Action: reduce to "Uses target/test-work/containers/bctest, building it if absent."

## Comments to keep as written

- **Cargo.toml:10.** The pin tied to the audited nix source is a real invariant.
- **main.rs:36-37.** Explains why usage errors come before the root check.
- **error.rs:1-2.** A message-format convention, verified true for every variant.
- **status.rs:1, 9.** A precise caller contract.
- **container.rs:14-15, 40-41.** Hostname rule with the kernel limit; resolution rule.
- **stack.rs:8-12, 24-25, 30.** `DEFAULT`, the reason for `MAX`, the `StackSize` constructor invariant, and the parse grammar.
- **clone.rs:1-28 (module invariants).** Clear, labeled and cross-referenced, apart from L3 and L4.
- **clone.rs:62-76 (`CLONE_FLAGS`, created flags).** Each line gives domain meaning and a reason, including the systemd shared-propagation point.
- **clone.rs:115-185 (SAFETY).** The Operation, Contract, Evidence and Postconditions structure is accurate against the nix source, clone(2), and the measured figures. Its length is earned: each obligation is discharged or explicitly left as A1. It contains no history or usage-site references. Fix only M1, L3, L5 and L7.
- **clone.rs:190-194, 235-236, 241-242.** The `only_thread` safety-usable contract, why nix cannot express the C4 flags, and why the unit test can only check refusal.
- **sandbox.rs:24, 31-32, 42-45, 51, 55-56, 70.** Device table provenance, the must-run-in-new-namespaces contract, propagation, the bind-mount reason and umask handling.
- **supervise.rs:27-28, 31-32, 51, 59, 85-93.** PATH rationale, the PID 1 failure contract, ordering after `enter`, orphan reaping, and the fd-closing safety conditions.
- **mkrootfs.sh:2-11, 20, 47, 49.**
- **tests/*.sh.** Headers and inline notes not listed above. They explain non-obvious test mechanics: why `ls` lists `sh`'s fds, why `grep -l`'s exit status is ignored, ancestry rather than name lookup, the pagemap method and the zombie-aware `alive`.

## Ranked summary

1. **M1.** clone.rs:160-162: rewrite E5(a) to "does not grow with input size", consistent with E5(b)'s +1 page in release.
2. **M2.** stack.rs:5-6: state that `tests/stack.sh` hard-codes 64 KiB (= MIN/16) and must change with `MIN`; "fails above", not "at".
3. **L1-L19.** Wording, drift and placement fixes (above). None changes a safety conclusion.

Empty bands: **High**.
