//! A register-only user-level context switch: save the callee saved registers and the stack
//! pointer of the current execution, load another's, and return into it. No system call, no
//! signal mask, no floating point control state beyond the callee saved registers.
//!
//! This is the "user-level thread switch" of the slides in its smallest form, and the primitive
//! under the `green` runtime. The technique (AAPCS64 callee saved set, a bootstrap trampoline for
//! new tasks, `br`/`ret` into the saved link address) follows the description in Dzania's "Green
//! Threads from Scratch" (https://dzania.github.io/green-threads-from-scratch/) and the
//! `rsroutine` repository; the code here is an independent Linux implementation for `aarch64` and
//! `x86_64`.

use std::arch::global_asm;
use std::cell::Cell;
use std::ptr;

use crate::stack::Stack;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("target fiber is not suspended (it is running, or has never been switched out of)")]
    NotSuspended,
    #[error("cannot switch a fiber to itself")]
    SameFiber,
    #[error("the saving fiber is suspended; only the running flow can save into it")]
    NotRunning,
    #[error("stack too small for a fiber's initial frame")]
    StackTooSmall,
}

// `ctxswitch_regswitch(save: *mut *mut u8, to: *mut u8)`: push callee saved state on the current
// stack, store the resulting stack pointer through `save`, adopt `to` as the stack pointer, pop
// callee saved state, return. `ctxswitch_tramp` is where a new fiber starts: it calls the entry
// function (held in a callee saved register) and traps if it ever returns.

#[cfg(target_arch = "x86_64")]
global_asm!(
    ".text",
    ".global ctxswitch_regswitch",
    ".type ctxswitch_regswitch,@function",
    "ctxswitch_regswitch:",
    "push rbp",
    "push rbx",
    "push r12",
    "push r13",
    "push r14",
    "push r15",
    "mov [rdi], rsp",
    "mov rsp, rsi",
    "pop r15",
    "pop r14",
    "pop r13",
    "pop r12",
    "pop rbx",
    "pop rbp",
    "ret",
    ".size ctxswitch_regswitch, .-ctxswitch_regswitch",
    ".global ctxswitch_tramp",
    ".type ctxswitch_tramp,@function",
    "ctxswitch_tramp:",
    "call r12",
    "ud2",
    ".size ctxswitch_tramp, .-ctxswitch_tramp",
);

#[cfg(target_arch = "aarch64")]
global_asm!(
    ".text",
    ".global ctxswitch_regswitch",
    ".type ctxswitch_regswitch,%function",
    "ctxswitch_regswitch:",
    "sub sp, sp, #176",
    "stp x19, x20, [sp, #0]",
    "stp x21, x22, [sp, #16]",
    "stp x23, x24, [sp, #32]",
    "stp x25, x26, [sp, #48]",
    "stp x27, x28, [sp, #64]",
    "stp x29, x30, [sp, #80]",
    "stp d8, d9, [sp, #96]",
    "stp d10, d11, [sp, #112]",
    "stp d12, d13, [sp, #128]",
    "stp d14, d15, [sp, #144]",
    "mov x2, sp",
    "str x2, [x0]",
    "mov sp, x1",
    "ldp x19, x20, [sp, #0]",
    "ldp x21, x22, [sp, #16]",
    "ldp x23, x24, [sp, #32]",
    "ldp x25, x26, [sp, #48]",
    "ldp x27, x28, [sp, #64]",
    "ldp x29, x30, [sp, #80]",
    "ldp d8, d9, [sp, #96]",
    "ldp d10, d11, [sp, #112]",
    "ldp d12, d13, [sp, #128]",
    "ldp d14, d15, [sp, #144]",
    "add sp, sp, #176",
    "ret",
    ".size ctxswitch_regswitch, .-ctxswitch_regswitch",
    ".global ctxswitch_tramp",
    ".type ctxswitch_tramp,%function",
    "ctxswitch_tramp:",
    "blr x19",
    "brk #0",
    ".size ctxswitch_tramp, .-ctxswitch_tramp",
);

#[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
compile_error!("regswitch supports x86_64 and aarch64 only");

extern "C" {
    fn ctxswitch_regswitch(save: *mut *mut u8, to: *mut u8);
    fn ctxswitch_tramp();
}

/// Bytes pushed by `ctxswitch_regswitch` (and so the size of a new fiber's initial frame).
#[cfg(target_arch = "x86_64")]
const FRAME: usize = 6 * 8;
#[cfg(target_arch = "aarch64")]
const FRAME: usize = 176;

/// A suspended (or not yet started) flow of control: a saved stack pointer and the stack it points into.
pub struct Fiber {
    // Safety invariant: `sp` is null while this flow is running (or, for `Fiber::current`, before
    // it has ever been switched away from); otherwise it is the stack pointer of a frame of
    // exactly `FRAME` bytes, either the initial frame built by `Fiber::new` or one pushed by
    // `ctxswitch_regswitch`, on the mapped stack owned by `stack`. A saved `sp` is consumed
    // (replaced by null) by the switch that enters it, so each saved state is entered once.
    sp: Cell<*mut u8>,
    started: Cell<bool>,
    finished: Cell<bool>,
    stack: Option<Stack>,
}

impl Fiber {
    /// The calling flow of control. Empty until it is switched away from; use it as the *save* side.
    pub fn current() -> Self {
        Fiber { sp: Cell::new(ptr::null_mut()), started: Cell::new(false), finished: Cell::new(false), stack: None }
    }

    /// A fiber that starts running `entry` on `stack` the first time it is switched to.
    ///
    /// `entry` must never return: if it does the fiber traps (`ud2`/`brk`), a defined crash. End it
    /// with a final switch to another fiber that never switches back. Dropping a fiber that was
    /// entered and not [`finished`](Fiber::mark_finished) leaks its stack instead of unmapping it.
    pub fn new(mut stack: Stack, entry: extern "C" fn()) -> Result<Self, Error> {
        if stack.len() < FRAME + 64 {
            return Err(Error::StackTooSmall);
        }
        // `top` is 16 byte aligned, derived from the stack's own pointer (keeps its provenance).
        let top = stack.top().map_addr(|a| a & !15);
        #[cfg(target_arch = "x86_64")]
        let sp = {
            // Layout from `sp` upward: r15 r14 r13 r12 rbx rbp, then the return address. After
            // `ret` the stack pointer is `top`, 16 byte aligned, as needed before the trampoline's `call`.
            // SAFETY: `top - 8 - FRAME .. top - 8` and the slot at `top - 8` lie inside the usable
            // stack (`len >= FRAME + 64` plus at most 15 bytes of alignment slack), so `sub` stays
            // in the one mapped object.
            let sp = unsafe { top.sub(8 + FRAME) };
            // SAFETY: the seven 8-byte slots `[sp, top)` are inside the usable stack, 8-byte
            // aligned (`top` is 16-aligned, `FRAME` and 8 are multiples of 8), and the stack is
            // exclusively owned and not yet referenced by anything else.
            unsafe {
                let w = sp.cast::<usize>();
                for i in 0..6 {
                    w.add(i).write(0);
                }
                w.add(3).write(entry as usize); // r12 slot: [r15, r14, r13, r12, rbx, rbp]
                w.add(6).write(ctxswitch_tramp as *const () as usize);
            }
            sp
        };
        #[cfg(target_arch = "aarch64")]
        let sp = {
            // SAFETY: `top - FRAME .. top` is inside the usable stack (`len >= FRAME + 64`).
            let sp = unsafe { top.sub(FRAME) };
            // SAFETY: the 176 byte frame `[sp, top)` is inside the usable stack, `sp` is 16-byte
            // aligned (top is 16-aligned and 176 = 11 * 16), and the stack is exclusively owned
            // and unreferenced.
            unsafe {
                let w = sp.cast::<usize>();
                for i in 0..(FRAME / 8) {
                    w.add(i).write(0);
                }
                w.add(0).write(entry as usize); // x19 slot: the trampoline `blr x19`
                w.add(11).write(ctxswitch_tramp as *const () as usize); // x30 slot at offset 88: `ret` target
            }
            sp
        };
        Ok(Fiber { sp: Cell::new(sp), started: Cell::new(false), finished: Cell::new(false), stack: Some(stack) })
    }

    /// Record that this fiber's entry function will never run again and holds no live frames, so
    /// its stack may be unmapped when the fiber drops.
    ///
    /// # Safety
    ///
    /// Every frame on this fiber's stack, including the caller's, must be a plain frame that owns
    /// nothing needing `Drop` and whose memory nothing else references, and the caller must switch
    /// away immediately and never be resumed.
    pub unsafe fn mark_finished(&self) {
        self.finished.set(true);
    }

    /// Save the running flow into `self` and run `to`. Returns when something switches back to `self`.
    ///
    /// `self` must be the running flow's handle (its saved pointer is null); `to` must be suspended.
    pub fn switch(&self, to: &Fiber) -> Result<(), Error> {
        if ptr::eq(self, to) {
            return Err(Error::SameFiber);
        }
        if !self.sp.get().is_null() {
            return Err(Error::NotRunning);
        }
        // Take the target's saved pointer: afterwards it is "running", and a second switch to it
        // before it is suspended again is rejected instead of reusing a stale pointer.
        let target = to.sp.replace(ptr::null_mut());
        if target.is_null() {
            return Err(Error::NotSuspended);
        }
        to.started.set(true);
        // SAFETY: `target` is, by the type invariant on `sp`, either the initial frame built by
        // `Fiber::new` (the loads read the zeros, entry and trampoline written there, and `ret`
        // lands in the trampoline) or a frame pushed by this routine when that fiber was switched
        // away from, on a stack its owner still holds (a started, unfinished stack is leaked, never
        // unmapped, see `Drop`). It was just removed from `to.sp`, so it is entered once.
        // `self.sp.as_ptr()` is a valid, aligned `*mut *mut u8` that outlives the call, and `self`
        // was running (null `sp`), so no suspended state is overwritten. All fibers run on one OS
        // thread (`Fiber` is `!Send`: `Cell` and raw pointers). Callee saved registers are
        // preserved by the routine; every other register is caller saved under the C ABI, which the
        // compiler already assumes at an `extern "C"` call. The x87 control word, MXCSR and FPCR are
        // not saved: safe code cannot change them.
        unsafe { ctxswitch_regswitch(self.sp.as_ptr(), target) };
        Ok(())
    }
}

impl Drop for Fiber {
    fn drop(&mut self) {
        // A started, unfinished fiber still has suspended frames that will never be dropped;
        // unmapping their stack could invalidate memory their owners expect to stay valid. Leak it.
        if self.started.get() && !self.finished.get() {
            std::mem::forget(self.stack.take());
        }
    }
}
