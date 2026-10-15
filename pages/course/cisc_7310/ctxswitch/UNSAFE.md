# Unsafe audit of ctxswitch

Applied: Google's `unsafe_rust_review` skill (https://github.com/google/rust-skills/tree/main/unsafe_rust_review), by two independent cold auditor passes (a model reviewer given the skill text; static reading plus builds, not a human audit). Pass 1 found 7 rejections; each was fixed; pass 2 re-audited every site and found 0. The first pass's findings are summarized here, and the second pass report follows verbatim.

| First pass rejection | Fix |
|---|---|
| R1 `Context::swap` never consumed its target | `swap` clears the target's `ready` before switching and rejects a suspended `self` |
| R2 `uc_link` validity never established | non-null links only through `unsafe bind_linked` / `spawn_linked`, with a stated contract |
| R3 stacks unmapped while holding live frames | a stack ever entered is leaked on drop unless `unsafe mark_finished` (only `green` uses it) |
| R4 unguarded, unchecked heap stacks | heap stacks deleted; only guarded `mmap` stacks, with a minimum size |
| R5 raw pointers derived from a moved `Box` | `NonNull` from `Box::into_raw` / `mmap`, freed once in `Drop` |
| R6 `getcontext` returning twice in Rust | the double return runs inside `global_asm` (`ctxswitch_twice`); Rust only sees `body(pass)` called |
| R7 `Fiber::switch` did not check `self` is running | rejects a `self` with a saved pointer |

The accepted residual risks are listed in the second pass report below.

Open rejections: 0

---

# Unsafe re-audit: crate `ctxswitch` (second pass)

Standard applied: Google `unsafe_rust_review` skill (verbatim copy in
`research/unsafe-rust-review-SKILL.md`). Target: Linux glibc on x86_64 and
aarch64. This pass re-audits the code after the fixes for the seven rejections
(R1..R7) of `reviews/unsafe-audit.md`, and re-audits every unsafe site from
scratch.

Verdict policy. REJECT means safe code can reach UB through the site, or no
caller can discharge the contract with any premise from the evidence hierarchy.
ACCEPT WITH NOTE means the operation is sound but the written proof carries a
missing, imprecise, or stylistic defect, or the site leaves a residual
non-UB hazard worth recording. ACCEPT means sound with an adequate proof.

Method. The audit is static; contracts were read from the glibc `getcontext(3)`
/ `makecontext(3)` / `swapcontext(3)` manuals, the SysV x86-64 psABI and
AAPCS64, and the std 1.92 docs for `Box`, `Cell`/`UnsafeCell`, `NonNull`,
`ptr`, and `mem::zeroed`. As a confidence check (not a proof premise), the crate
was built and run in the Linux container (`./scripts-dev.sh`, which runs an
emulated **x86_64** `rust:1-slim` image): `uctxswitch` shows the `getcontext`
double return calling `body(0)` then `body(1)`; `uctxswap` runs the full
`func2 -> func1 -> main` `uc_link` chain to "main: exiting"; `uctxmake` reaches
`hello_user`; and `switchbench --mechanisms green,regswitch,ucontext` runs all
three user-level mechanisms with no fault. The aarch64 assembly paths were
audited by derivation only (the host image is amd64).

## R1..R7 disposition

| # | Previous rejection | Fix in the new code | Discharged? |
|---|--------------------|---------------------|-------------|
| R1 | `swap` never consumes the target; a resumed-then-returned state stays `ready`; `self` not required to be the running flow | `swap` now rejects `self.ready` as `NotRunning` (uctx.rs:172-174), requires `to.ready` (175-177), and **consumes** `to` plus marks `self` running *before* `swapcontext`: `to.ready.set(false); to.started.set(true); self.ready.set(true)` (uctx.rs:180-182); the `-1` path restores `self.ready=false, to.ready=true` (uctx.rs:192-196). `ready==true` now holds only for a genuinely-suspended live frame (a suspended frame cannot "return"), and a resumed state is `ready==false` so it cannot be re-entered. | YES |
| R2 | `uc_link` validity never established; safe API could install a stale/blank successor | `bind`/`spawn` (safe) always pass `None` → null `uc_link` (uctx.rs:101,134,147); a non-null successor is reachable only via `unsafe bind_linked`/`spawn_linked` (uctx.rs:113,158) whose `# Safety` requires `link` to be *suspended with a live frame* when `entry` returns. Safe-only code can never set a non-null `uc_link`. | YES |
| R3 | stacks unmapped while holding live suspended frames, or while running | leak-on-drop policy: `Stack` is kept inside `Context`/`Fiber`; `Context::drop` `mem::forget`s the stack when `started` (uctx.rs:284-286); `Fiber::drop` forgets it when `started && !finished` (regswitch.rs:240-242). `started` is set on every entry (`swap`/`enter`/`switch` set `to.started`/`self.started`). The policy keys on *ever entered*, not on *currently holds a saved pointer*, so a flow that saved its state into a foreign handle still leaks its own stack. Safe code cannot clear `started` or set `finished` (both private; `mark_finished` is `unsafe`). | YES |
| R4 | execution stacks with no size/guard check (`Stack::heap`, `makecontext` on tiny stacks) | the unguarded `Stack::heap` backing is **deleted**; only `Stack::guarded` exists (stack.rs:28), always with a `PROT_NONE` guard page. `bind_inner` rejects `stack.len() < MIN_LEN` (uctx.rs:121-123); `Fiber::new` rejects `< FRAME + 64` (regswitch.rs:145). Overflow now hits the guard page (defined fault), never neighbouring heap. | YES |
| R5 | raw pointers derived from a `Box`/`Pin<Box>` used after the box moves | `Context` stores `NonNull<UnsafeCell<ucontext_t>>` from `Box::into_raw` (uctx.rs:48,66), accessed only through `raw` (uctx.rs:81), freed once in `Drop` via `Box::from_raw` (uctx.rs:290); the heap allocation never moves. `Stack` stores `NonNull<u8>` straight from `mmap` (stack.rs:21), not a `Box`. No `Pin`, no box-after-move. Field invariants are documented (`// Safety invariant:` at uctx.rs:45, stack.rs:18, regswitch.rs:122). | YES |
| R6 | `capture_raw` returns-twice relied on `#[inline(always)]`, undischargeable | `capture_raw` is **deleted**. The double return now runs entirely in the `ctxswitch_twice` `global_asm!` routine (uctx.rs:300-354): it calls `getcontext`/the body loop in assembly, keeps the pass counter in its own asm frame (which `setcontext` restores), and Rust only ever sees `body` being *called*. `run_twice` and `Context::resume` are `unsafe` with a plain-old-frame `# Safety` contract (uctx.rs:219-224,362-368). Rust never observes a returns-twice call. | YES |
| R7 | `Fiber::switch` did not check `self` is the running flow | `switch` now returns `NotRunning` unless `self.sp` is null (regswitch.rs:210-212), and consumes the target with `to.sp.replace(null)` (regswitch.rs:215). `self` running + target consumed-once. | YES |

All seven are discharged.

## Site table (every unsafe site re-audited)

Classification tags: AX = Reference/std axiom, DL = dependency lemma (glibc/libc),
PRE = `# Safety` precondition, INV = documented project invariant, LF = local
fact, TF = type-system fact, PC = postcondition.

| # | Site | Operation | Contract | Premises | Verdict |
|---|------|-----------|----------|----------|---------|
| 1 | stack.rs:33 | `libc::sysconf(_SC_PAGESIZE)` | FFI, no memory precond | integer arg, no pointer (LF); `-1` rejected by `try_from` (LF) | ACCEPT |
| 2 | stack.rs:44 | `libc::mmap` anon private | mmap(2) args | null hint, fd -1 + MAP_ANONYMOUS (LF); `map_len >= 2*page > 0` (LF, checked_add); MAP_FAILED checked (LF); page-aligned result (DL) | ACCEPT |
| 3 | stack.rs:64-65 | `map.add(page)` + `mprotect` | `add` in bounds; page-aligned sub-range of one mapping | `page + usable == map_len` (LF); mmap page-aligned (DL); one allocation (AX via FFI) | ACCEPT |
| 4 | stack.rs:76 | `map.add(guard)` in `base()` | `add` in bounds | `guard == page`, `map_len >= 2*page` so `guard < map_len` strictly — the invariant now always holds because `guarded(len<MIN_LEN)` is rejected (old ACCEPT-WITH-NOTE resolved) (LF/INV) | ACCEPT |
| 5 | stack.rs:92 | `map.add(map_len)` in `top()` | `add` to one-past-end | result is one past the single mapping, never dereferenced (AX) | ACCEPT |
| 6 | stack.rs:102 | `libc::munmap` in `Drop` | region not in use after unmap | `map`/`map_len` are the mmap values (INV); drop runs once (AX); started-and-unfinished owners `mem::forget` the `Stack`, so no live frame's stack is ever reached here (INV: leak policy, R3) | ACCEPT |
| 7 | uctx.rs:65 | `mem::zeroed::<ucontext_t>()` | all-zero valid for the type | every field is an integer, integer array, or raw pointer (TF, libc 0.2); zero valid for each (AX) | ACCEPT |
| 8 | uctx.rs:69 | `NonNull::new_unchecked(Box::into_raw(..))` | arg non-null | `Box::into_raw` never returns null (AX) | ACCEPT |
| 9 | uctx.rs:81 | `self.raw.as_ref().get()` | pointee live for `&self` | `raw` from `into_raw`, freed only in `Drop`, never moved out (INV) | ACCEPT |
| 10 | uctx.rs:91 | `getcontext(ctx.as_ptr())` | writable `ucontext_t` | live address-stable box (TF/INV); `!Sync`, nothing else writes (TF); the saved return point is overwritten by `makecontext` before any `swap`/`enter`, and `resume` is `unsafe`, so safe code can never re-enter this getcontext point twice (LF) | ACCEPT |
| 11 | uctx.rs:113 | `bind_linked` (`unsafe fn`) | caller: `link` suspended with a live frame when `entry` returns; nothing swaps to `link` afterward | contract names the party and the temporal scope; complete enough that the consumer can discharge it (see uctxswap rows) | ACCEPT WITH NOTE (a) |
| 12 | uctx.rs:131-135 | writes to `uc_stack`/`uc_link` | raw writes to live context; installed state must be well-defined | `p` live, address-stable, getcontext-filled (INV/PC); `ss_sp/ss_size` from a live guarded mapping kept alive (and leaked once entered) by `self.stack` (INV); `uc_link` null (safe) or caller-guaranteed (PRE of bind_linked) | ACCEPT |
| 13 | uctx.rs:139 | `makecontext(p, entry, 0)` | adequately sized stack; argc matches signature | argc 0 ↔ `extern "C" fn()` (TF); `stack.len() >= MIN_LEN` checked (LF) and the stack is guarded, so overflow faults on the guard page (R4) | ACCEPT |
| 14 | uctx.rs:158 | `spawn_linked` (`unsafe fn`) | see bind_linked | delegates the same contract | ACCEPT WITH NOTE (a) |
| 15 | uctx.rs:161 | `ctx.bind_linked(..)` | bind_linked precond | caller upholds via `spawn_linked`'s own `# Safety` (PRE) | ACCEPT |
| 16 | uctx.rs:191 | `swapcontext(self, to)` | `to` holds a live entered-once state; `self` is the running flow | distinct boxes (LF, SameContext check); `to.ready` true then cleared before the call, only `swapcontext`/`makecontext`/entry sets it (LF/INV); `self.ready` false ⇒ running flow (LF); `ready==true` ⟺ live suspended frame (INV, R1); one OS thread (`!Send`, TF) | ACCEPT |
| 17 | uctx.rs:212 | `setcontext(self)` in `enter` | target state live; caller frames abandoned | `ready` consumed before use (LF, R1); abandoned caller frames only leak, which is safe (AX) | ACCEPT WITH NOTE (b) |
| 18 | uctx.rs:226-229 | `resume` (`unsafe fn`) + `setcontext` | caller: `self` is the active `run_twice` context; `body` holds no Drop/borrow/lock across the call | POF obligation on the caller (PRE); setcontext target live for the duration of the owning `run_twice` frame (PRE) | ACCEPT |
| 19 | uctx.rs:239 | `ptr::read(addr_of!(gregs))` | aligned, initialized, no concurrent writer | live aligned box (TF); integer array filled by zeroing/getcontext (PC); `&self`, single thread (LF) | ACCEPT |
| 20 | uctx.rs:260-265 | `ptr::read(regs/sp/pc)` (aarch64) | as #19 | as #19; `[u64;31]`, `u64`, `u64` (TF) | ACCEPT |
| 21 | uctx.rs:290 | `Box::from_raw(self.raw.as_ptr())` in `Drop` | reconstruct the one owner; no double free; no live alias | `raw` from `into_raw` (INV); drop runs once (AX); a `uc_link` into this context is kept alive by the holder's `Rc`, so no holder remains when this runs (INV) | ACCEPT |
| 22 | uctx.rs:300-326 | x86_64 `global_asm! ctxswitch_twice` | SysV ABI; counter preserved; ctx/body survive setcontext | frame: push rbp/rbx/r12 + `sub rsp,16` ⇒ rsp ≡ 0 (mod 16) at `call getcontext@PLT` and at `call r12` (derived, AX psABI); counter at `[rsp]` in the routine's own frame, which getcontext saves and setcontext restores (DL getcontext/setcontext); `ctx` in rbx, `body` in r12 are callee-saved **and** explicitly saved/restored by getcontext/setcontext (DL); counter is loaded, incremented, and stored *before* `call r12`, so each return reads the next value; body gets `pass` in edi ↔ `extern "C" fn(u32)` (TF). Runtime check: `uctxswitch` prints pass 0 then pass 1. | ACCEPT |
| 23 | uctx.rs:328-350 | aarch64 `global_asm! ctxswitch_twice` | AAPCS64; counter preserved | `stp x29,x30,[sp,#-48]!` ⇒ sp 16-aligned (48=3*16) at `bl getcontext`/`blr x20` (derived, AX AAPCS64); counter at `[sp,#32]`, incremented before `blr`; ctx/body in x19/x20, callee-saved and saved by getcontext (DL); `pass` in w0 (TF). getcontext uses `bl` (no PLT needed; local dynamic resolution) | ACCEPT |
| 24 | uctx.rs:352-354,369-374 | `extern "C"` decl + `ctxswitch_twice(..)` in `run_twice` (`unsafe fn`) | declared sig matches asm; two-returns obligations on caller | signature `(*mut ucontext_t, extern "C" fn(u32))` ↔ rdi/rsi, x0/x1 (LF); `ctx.as_ptr()` live for the `&Context` borrow (TF); POF in `# Safety` (PRE) | ACCEPT |
| 25 | regswitch.rs:36-63 | x86_64 `global_asm! ctxswitch_regswitch`/`tramp` | SysV callee-saved set; trampoline alignment | saves/restores rbx, rbp, r12-r15 (complete integer callee-saved set, AX psABI); after `ret` rsp = `top` (16-aligned), so `call r12` in the trampoline is ABI-aligned (derived); `ud2` on return = defined crash. Not saved: x87 control word, MXCSR — safe Rust cannot change them, so logic-only (see note c) | ACCEPT WITH NOTE (c) |
| 26 | regswitch.rs:66-104 | aarch64 `global_asm! ctxswitch_regswitch`/`tramp` | AAPCS64 | x19-x28, x29, x30, d8-d15 low-64 (complete callee-saved set, AX AAPCS64); `176 % 16 == 0` keeps sp aligned; `brk #0` = defined crash; FPCR not saved (note c) | ACCEPT WITH NOTE (c) |
| 27 | regswitch.rs:109-112 | `extern "C"` declarations | sigs match asm | `(*mut *mut u8, *mut u8)` ↔ rdi/rsi, x0/x1 (LF); `ctxswitch_tramp` address-only use (LF) | ACCEPT |
| 28 | regswitch.rs:157,161-168 | x86_64 initial-frame writes | `write`/`sub` aligned, in bounds | `top & !15`; `sp = top-(8+FRAME)`; 6 callee slots `[sp,top-8)` + return slot `[top-8,top)`, all 8-aligned inside usable bytes (`len >= FRAME+64` + ≤15 slack) (LF); r12 slot (index 3)=entry, return slot (index 6)=`ctxswitch_tramp`; after `ret` rsp=`top` 16-aligned (derived); exposed provenance via `map_addr`/casts (AX). Runtime: `regswitch` bench runs. | ACCEPT |
| 29 | regswitch.rs:174,178-185 | aarch64 initial-frame writes | as #28 | `sp = top-176`, 16-aligned (176=11*16); 22 slots; x19 slot (0)=entry, x30 slot (offset 88, index 11)=`ctxswitch_tramp` ↔ `stp x29,x30,[sp,#80]` (derived) | ACCEPT |
| 30 | regswitch.rs:199-201 | `mark_finished` (`unsafe fn`) | caller: every frame is a plain frame owning nothing Drop-worthy and unreferenced; caller switches away immediately and is never resumed | contract names party, extent, and the follow-on obligation; green.rs:121 discharges it | ACCEPT |
| 31 | regswitch.rs:231 | `ctxswitch_regswitch(self.sp.as_ptr(), target)` | `target` a once-consumed frame on a still-mapped stack; `self` the running flow | `target` from `to.sp.replace(null)` (LF, consumed once); initial or routine-pushed frame on an owner-held stack, leaked if started-and-unfinished (INV, R3); `self.sp` null ⇒ running (LF, R7); `self.sp.as_ptr()` valid `*mut *mut u8` (TF); one OS thread (`!Send`, TF); callee-saved preserved, rest caller-saved per ABI (AX) | ACCEPT |
| 32 | green.rs:117 | `&*fiber` (raw deref) | pointee live, not `&mut`-aliased | `fiber` points into the `Task`; `run()` holds `task` and `s.running` (two strong `Rc<Task>`) across the whole task, until `sched.switch` returns there; dropping task_main's own clone first only decrements a count those two keep above zero (INV, documented at green.rs:92) | ACCEPT |
| 33 | green.rs:121 | `fiber.mark_finished()` | mark_finished precond | `body` consumed and `task` dropped (LF); trampoline frame below owns nothing (LF); the following `switch(&s.sched)` never returns here and the scheduler never re-queues a finished task (INV); so no frame or reference into the stack survives when `Fiber::drop` later unmaps it (PRE discharged) | ACCEPT |
| 34 | bin/uctxswitch.rs:27 | `CONTEXT.resume()` | resume POF | `println!` temporaries and stdout lock gone; `with` closure only borrows the thread-local; no Drop value live at the call (LF) | ACCEPT |
| 35 | bin/uctxswitch.rs:35 | `run_twice(c, body)` | run_twice contract | `body` only resumes `CONTEXT`, while the call is active, holds no Drop value, cannot unwind (`extern "C"`) (PRE discharged) | ACCEPT |
| 36 | bin/uctxrestore.rs:17 | `CURR.resume()` | resume POF | as #34; `sleep` returned, no live temporaries (LF) | ACCEPT |
| 37 | bin/uctxrestore.rs:24 | `run_twice(c, body)` | run_twice contract | as #35 | ACCEPT |
| 38 | bin/uctxswap.rs:57 | `spawn_linked(.., main_ctx, func1)` | bind_linked uc_link contract | when `func1` returns, `main` is suspended inside `m.swap(&c2)` (it never returns before the chain ends), so `main_ctx`'s saved frame is live; nothing swaps to `main_ctx` after (PRE discharged, LF). Runtime: chain ends at "main: exiting". | ACCEPT |
| 39 | bin/uctxswap.rs:70 | `spawn_linked(.., c1, func2)` | bind_linked uc_link contract | `func2` returns only after its `swap(func2->func1)` resumed it, at which point `func1` is suspended in `swap(func1->func2)`, so `c1` is live; glibc enters it once; nothing swaps to `c1` after (PRE discharged, LF) | ACCEPT |

No site is a REJECT.

## Notes attached to ACCEPT WITH NOTE verdicts

- **(a) `bind_linked`/`spawn_linked` leave a stale `ready` flag on `link`.** When
  glibc enters `link` through `uc_link` (not through `swap`), this type's
  `ready` bookkeeping is bypassed: `link.ready` stays whatever `swap` last set it
  to (typically `true`, because `link` was the save side of a `swap`). The
  `# Safety` contract correctly forbids swapping to `link` after it is entered
  this way, so a correct unsafe caller never triggers the hazard, and purely-safe
  code can never install a non-null `uc_link` at all (so safe-only code never
  reaches a stale `ready`). This is sound, but the contract is carried by prose,
  not by the type: the flag is a loaded gun for any later `swap(&link)`. A
  sturdier design would clear `link.ready` (and consume the successor) at
  `bind_linked`, or have glibc-entered returns funnel through a crate trampoline
  that fixes the bookkeeping. Recorded as residual risk 1.

- **(b) `Context::enter` on a `bind` (null-`uc_link`) context exits the whole
  process when `entry` returns.** This is glibc `makecontext` behaviour (null
  `uc_link` ⇒ the successor is "exit"), exercised by `uctxmake`. It is
  memory-safe (a process exit is allowed from safe code at any point, like
  `std::process::exit`), and `enter`'s doc says control never returns to the
  caller, but the "returning from `entry` tears down the process" consequence is
  surprising and is only spelled out in the `uctxmake` binary, not on `enter`.
  Recorded as residual risk 2.

- **(c) Floating-point control registers are not saved by either switch
  routine.** `ctxswitch_regswitch` preserves the integer callee-saved set and
  (on aarch64) d8-d15, but not the x87 control word, MXCSR, or FPCR. Safe Rust
  provides no API to change those control words, so a divergence is a logic
  difference, never UB, for any safe client. If a client ever runs
  `target_feature`/intrinsic code that alters rounding or mask bits across a
  switch, that is out of scope of the current safe surface. Also: the three
  `ctxswitch_*` and `getcontext` symbols are plain `.global` names with no CFI;
  a symbol collision in the final link, or a truncated backtrace through the
  trampoline, is a build/debug concern, not a soundness one.

## Numbered rejections

None. All unsafe sites discharge their contracts, and no safe-code path reaches
undefined behaviour.

## Residual risks (non-UB, or gated behind an unsafe contract)

1. **Stale `ready` on `uc_link` successors** (note a). Gated behind
   `unsafe bind_linked`/`spawn_linked`; no safe-only path reaches it. Still a
   fragile prose-only invariant.
2. **`enter` on a bound context exits the process on `entry` return** (note b).
   Memory-safe glibc behaviour; surprising and under-documented on `enter`.
3. **Fiber handle "running" by null `sp` but not the running flow.** Two live
   `Fiber::current()` handles (or any null-`sp` handle created while its flow is
   suspended) both pass the `NotRunning` check. Using the wrong one as the save
   side saves the *genuinely running* register state into that handle, which is
   memory-safe: a switch always captures the real running context, the target is
   still consumed exactly once, and the drop-leak policy keeps every `started`
   stack mapped, so no pointer ever dangles. The effect is a logic error (control
   resumes an unexpected flow / a stack leaks), never UB. The crate's own clients
   (`green`, `bench::user`) never construct the ambiguous state.
4. **Conservative leaks.** `Context::drop` leaks the stack of *any* started
   context (there is no `finished` flag for `Context`), and the `swap` `-1`
   error path leaves `to.started == true`; both over-leak on cold paths. Memory
   is reclaimed by process exit. Not UB.
5. **Unbounded-but-safe FP state and symbol/CFI gaps** (note c).
6. **makecontext minimum stack.** `MIN_LEN` (one page) is accepted for a
   `makecontext` stack; a deep `entry` (e.g. heavy `printf`) could overflow, but
   onto the guard page, so the result is a defined fault, not corruption.

