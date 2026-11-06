//! Safe wrappers around glibc's `ucontext` family, ported from the `umcontext` examples.
//!
//! Model. A [`Context`] is a heap allocated `ucontext_t` at a fixed address. It is *ready* while it
//! holds a state that can be switched to exactly once: after `makecontext`, or after it was the save
//! side of a [`Context::swap`]. Switching to a ready context consumes the state, so a stale frame
//! is never resumed from safe code.
//!
//! Two things cannot be safe and are `unsafe` with stated contracts: [`Context::bind_linked`] (a
//! `uc_link` successor is entered by glibc without our bookkeeping) and [`run_twice`] together
//! with [`Context::resume`] (`getcontext` returning twice, kept out of Rust's sight in assembly).

use std::arch::global_asm;
use std::cell::{Cell, RefCell, UnsafeCell};
use std::thread::LocalKey;
use std::io;
use std::mem;
use std::ptr::NonNull;
use std::rc::Rc;

use libc::ucontext_t;

use crate::stack::{self, Stack};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{call} failed: {source}")]
    Os { call: &'static str, source: io::Error },
    #[error("target context is not ready (never bound, already switched to, or running)")]
    NotReady,
    #[error("the saving context is itself suspended; only the running flow can save into it")]
    NotRunning,
    #[error("context was not captured with getcontext before makecontext")]
    NotCaptured,
    #[error("cannot swap a context with itself")]
    SameContext,
    #[error("stack is smaller than {} bytes", stack::MIN_LEN)]
    StackTooSmall,
}

fn os(call: &'static str) -> Error {
    Error::Os { call, source: io::Error::last_os_error() }
}

/// A `ucontext_t` at a fixed address, plus the stack and link it depends on.
pub struct Context {
    // Safety invariant: `raw` came from `Box::into_raw(Box::new(UnsafeCell<ucontext_t>))`, is never
    // moved out of, is freed only in `Drop`, and so keeps one address for the life of the
    // `Context` (glibc stores self pointers in it on x86_64). All access is through `raw`.
    raw: NonNull<UnsafeCell<ucontext_t>>,
    ready: Cell<bool>,
    started: Cell<bool>,
    captured: bool,
    /// Kept alive because `ss_sp` points into it. Leaked, not unmapped, if a flow was entered here.
    stack: Option<Stack>,
    /// Kept alive because `uc_link` points at it.
    _link: Option<Rc<Context>>,
}

impl Context {
    /// An empty context: valid as the *save* side of [`Context::swap`], not yet a swap target.
    pub fn blank() -> Self {
        // SAFETY: `ucontext_t` is a plain C struct of integers, arrays of integers and raw
        // pointers (on x86_64 including a pointer to its own FP state). The all-zero bit pattern is
        // valid for each of those field types (zero integers, null raw pointers), so `mem::zeroed`
        // produces a valid `ucontext_t`.
        let zero: ucontext_t = unsafe { mem::zeroed() };
        let raw = Box::into_raw(Box::new(UnsafeCell::new(zero)));
        Context {
            // SAFETY: `Box::into_raw` never returns null.
            raw: unsafe { NonNull::new_unchecked(raw) },
            ready: Cell::new(false),
            started: Cell::new(false),
            captured: false,
            stack: None,
            _link: None,
        }
    }

    fn as_ptr(&self) -> *mut ucontext_t {
        // `UnsafeCell<T>` is `repr(transparent)`; `get` is a safe method on a raw-pointer-derived reference.
        // SAFETY: `raw` is valid and live for the whole life of `self` (type invariant).
        unsafe { self.raw.as_ref() }.get()
    }

    /// Port of a bare `getcontext` into a fresh context that is only ever *bound* afterwards. The
    /// result is not ready: its saved program counter points into this function's frame, which is
    /// gone once it returns, so it can never be switched to until [`Context::bind`] replaces that.
    pub fn captured() -> Result<Self, Error> {
        let mut ctx = Context::blank();
        // SAFETY: `as_ptr()` is the live, address-stable `ucontext_t` owned by `ctx`; nothing
        // else accesses it (`Context` is `!Sync`); `getcontext` only writes it.
        if unsafe { libc::getcontext(ctx.as_ptr()) } == -1 {
            return Err(os("getcontext"));
        }
        ctx.captured = true;
        Ok(ctx)
    }

    /// Port of `ss_sp = ..; ss_size = ..; makecontext(.., entry, 0)` on a context from
    /// [`Context::captured`], with no successor: when `entry` returns, glibc ends the thread.
    pub fn bind(&mut self, stack: Stack, entry: extern "C" fn()) -> Result<(), Error> {
        self.bind_inner(stack, None, entry)
    }

    /// Like [`Context::bind`], with `link` as `uc_link`: when `entry` returns, glibc `setcontext`s into `link`.
    ///
    /// # Safety
    ///
    /// At the moment `entry` returns, `link` must be *suspended with a live frame*: it was the save
    /// side of a [`Context::swap`] whose caller has not returned, or it is a context bound with
    /// `bind` and never entered. glibc enters it without going through [`Context::swap`], so this
    /// type's `ready` bookkeeping is stale for the rest of that flow: nothing may `swap` to `link`
    /// after it is entered this way.
    pub unsafe fn bind_linked(&mut self, stack: Stack, link: Rc<Context>, entry: extern "C" fn()) -> Result<(), Error> {
        self.bind_inner(stack, Some(link), entry)
    }

    fn bind_inner(&mut self, mut stack: Stack, link: Option<Rc<Context>>, entry: extern "C" fn()) -> Result<(), Error> {
        if !self.captured {
            return Err(Error::NotCaptured);
        }
        if stack.len() < stack::MIN_LEN {
            return Err(Error::StackTooSmall);
        }
        let p = self.as_ptr();
        // SAFETY: `p` is the live address-stable `ucontext_t` owned by `self`, filled by
        // `getcontext` in `captured`. The fields written are plain data. `stack.base()`/`len()`
        // describe a live guarded mapping that `self.stack` keeps alive (and, once entered, leaks)
        // for as long as the context exists. `link`'s address is stable (its `raw` never moves)
        // and `self._link` keeps it allocated; its *state* validity is the caller's contract for
        // `bind_linked`, and `None` gives a null `uc_link`.
        unsafe {
            (*p).uc_stack.ss_sp = stack.base().cast();
            (*p).uc_stack.ss_size = stack.len();
            (*p).uc_link = link.as_ref().map_or(std::ptr::null_mut(), |l| l.as_ptr());
        }
        // SAFETY: `p` was filled by `getcontext`, a guarded stack of at least one page and its size
        // were installed, and `entry` is an `extern "C" fn()` taking zero arguments, matching
        // `argc == 0`. The first switch to this context starts `entry` on the new stack.
        unsafe { libc::makecontext(p, entry, 0) };
        self.stack = Some(stack);
        self._link = link;
        self.ready.set(true);
        Ok(())
    }

    /// `captured` then `bind`, for programs that do not print the intermediate state.
    pub fn spawn(stack: Stack, entry: extern "C" fn()) -> Result<Self, Error> {
        let mut ctx = Context::captured()?;
        ctx.bind(stack, entry)?;
        Ok(ctx)
    }

    /// `captured` then `bind_linked`.
    ///
    /// # Safety
    ///
    /// See [`Context::bind_linked`].
    pub unsafe fn spawn_linked(stack: Stack, link: Rc<Context>, entry: extern "C" fn()) -> Result<Self, Error> {
        let mut ctx = Context::captured()?;
        // SAFETY: the caller upholds `bind_linked`'s contract.
        unsafe { ctx.bind_linked(stack, link, entry)? };
        Ok(ctx)
    }

    /// Port of `swapcontext(&self, &to)`: save the running flow into `self` and run `to`. Returns
    /// when something later switches back to `self`. `to`'s state is consumed: it is not ready again
    /// until it saves a new state.
    pub fn swap(&self, to: &Context) -> Result<(), Error> {
        if std::ptr::eq(self, to) {
            return Err(Error::SameContext);
        }
        if self.ready.get() {
            return Err(Error::NotRunning);
        }
        if !to.ready.get() {
            return Err(Error::NotReady);
        }
        // Update the bookkeeping *before* control leaves this call: whatever runs next may swap
        // straight back to `self`, and must not be able to reuse `to`'s consumed state.
        to.ready.set(false);
        to.started.set(true);
        self.ready.set(true);
        // SAFETY: both pointers are live, address-stable and distinct (checked above). `to` was
        // ready, i.e. it holds either a `makecontext` state on a mapped guarded stack kept alive
        // by its owner (never freed once entered, see `Drop`), or a state saved by an earlier
        // `swapcontext` call whose caller frames are suspended, not returned: only the
        // `swapcontext` below can set `ready`, and `ready` is cleared before the state is used, so
        // each saved state is entered at most once. `self` was not ready, so it is the running
        // flow and no suspended state is overwritten. Everything runs on one OS thread
        // (`Context` is `!Send`, being `Rc`/raw-pointer based).
        let rc = unsafe { libc::swapcontext(self.as_ptr(), to.as_ptr()) };
        if rc == -1 {
            self.ready.set(false);
            to.ready.set(true);
            return Err(os("swapcontext"));
        }
        Ok(())
    }

    /// Port of `setcontext(&self)` for a bound or swapped-out context: enter it and never come back
    /// to the calling flow. Returns only on failure. The caller's frames are abandoned without
    /// being dropped, which leaks their values; that is safe, as with `mem::forget`.
    pub fn enter(&self) -> Error {
        if !self.ready.get() {
            return Error::NotReady;
        }
        self.ready.set(false);
        self.started.set(true);
        // SAFETY: `self.as_ptr()` is live and address-stable; `ready` means it holds a state that
        // may be entered exactly once (see `swap`), and `ready` was cleared before use. Nothing
        // saves the abandoned flow, so no one can later resume its frames.
        unsafe { libc::setcontext(self.as_ptr()) };
        self.ready.set(true);
        os("setcontext")
    }

    /// Port of `setcontext(&self)` for a context saved by [`run_twice`]. Never returns on success.
    ///
    /// # Safety
    ///
    /// `self` must be the context that the currently running [`run_twice`] passed to `getcontext`,
    /// and its `body` must not hold values with destructors, borrows, or locks across this call:
    /// the frames of `body` and everything below it are abandoned without being dropped (the
    /// stack pointer jumps back into the assembly frame of `run_twice`).
    #[inline(never)]
    pub unsafe fn resume(&self) -> Error {
        // SAFETY: `self.as_ptr()` is live and address-stable; the frame-liveness obligation is the caller's.
        unsafe { libc::setcontext(self.as_ptr()) };
        os("setcontext")
    }

    /// The registers `printctx.c` prints, in the same order, labelled for this architecture.
    // docs:begin printctx 2
    pub fn registers(&self) -> Vec<(&'static str, u64)> {
        let p = self.as_ptr();
        #[cfg(target_arch = "x86_64")]
        {
            // SAFETY: `p` is live and aligned; `gregs` is a plain integer array copied out by
            // value; nothing writes the context while this runs (single thread, `&self`).
            let g = unsafe { std::ptr::read(std::ptr::addr_of!((*p).uc_mcontext.gregs)) };
            // The C original prints RAX twice; the duplicate is kept for output parity.
            [
                ("RIP", libc::REG_RIP),
                ("RAX", libc::REG_RAX),
                ("RSP", libc::REG_RSP),
                ("RBP", libc::REG_RBP),
                ("RAX", libc::REG_RAX),
                ("RBX", libc::REG_RBX),
                ("RCX", libc::REG_RCX),
                ("RDX", libc::REG_RDX),
                ("RSI", libc::REG_RSI),
                ("RDI", libc::REG_RDI),
            ]
            .into_iter()
            .map(|(n, r)| (n, g[r as usize] as u64))
            .collect()
        }
        #[cfg(target_arch = "aarch64")]
        {
            // SAFETY: as above; `regs` is `[u64; 31]`, `sp` and `pc` are `u64`.
            let (regs, sp, pc) = unsafe {
                (
                    std::ptr::read(std::ptr::addr_of!((*p).uc_mcontext.regs)),
                    std::ptr::read(std::ptr::addr_of!((*p).uc_mcontext.sp)),
                    std::ptr::read(std::ptr::addr_of!((*p).uc_mcontext.pc)),
                )
            };
            const NAMES: [&str; 31] = [
                "X0", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "X8", "X9", "X10", "X11", "X12", "X13",
                "X14", "X15", "X16", "X17", "X18", "X19", "X20", "X21", "X22", "X23", "X24", "X25",
                "X26", "X27", "X28", "FP", "LR",
            ];
            let mut v: Vec<(&'static str, u64)> = vec![("PC", pc), ("SP", sp)];
            v.extend(NAMES.iter().copied().zip(regs));
            v
        }
    }
    // docs:end printctx 2
}

impl Drop for Context {
    fn drop(&mut self) {
        // A stack that a flow was entered on may still hold suspended frames that will never be
        // dropped. Unmapping it could free memory those frames' owners (pinned locals, scoped
        // threads) expect to stay valid, so such a stack is leaked on purpose.
        if self.started.get() {
            mem::forget(self.stack.take());
        }
        // SAFETY: `raw` came from `Box::into_raw` (type invariant), is freed only here, and
        // `drop` runs once. No other pointer is used after this: a `uc_link` into this context is
        // kept alive by the `Rc` its holder owns, so this runs only when no such holder remains.
        drop(unsafe { Box::from_raw(self.raw.as_ptr()) });
    }
}

// `getcontext` returns twice, which Rust cannot express. `ctxswitch_twice(ctx, body)` runs the
// double return entirely in assembly: it calls `getcontext(ctx)`, then calls `body(pass)` with
// pass = 0, 1, 2, ... once per return of `getcontext` (the counter lives in this routine's own
// frame, which survives `setcontext`). Rust only ever sees `body` being called, never a call that
// returns twice. Callee saved registers hold `ctx` and `body` across the `setcontext`, because
// `getcontext` saved and `setcontext` restores them.
#[cfg(target_arch = "x86_64")]
global_asm!(
    ".text",
    ".global ctxswitch_twice",
    ".type ctxswitch_twice,@function",
    "ctxswitch_twice:",
    "push rbp",
    "mov rbp, rsp",
    "push rbx",
    "push r12",
    "sub rsp, 16",
    "mov rbx, rdi",
    "mov r12, rsi",
    "mov dword ptr [rsp], 0",
    "mov rdi, rbx",
    "call getcontext@PLT",
    "mov edi, dword ptr [rsp]",
    "lea eax, [rdi + 1]",
    "mov dword ptr [rsp], eax",
    "call r12",
    "add rsp, 16",
    "pop r12",
    "pop rbx",
    "pop rbp",
    "ret",
    ".size ctxswitch_twice, .-ctxswitch_twice",
);

#[cfg(target_arch = "aarch64")]
global_asm!(
    ".text",
    ".global ctxswitch_twice",
    ".type ctxswitch_twice,%function",
    "ctxswitch_twice:",
    "stp x29, x30, [sp, #-48]!",
    "mov x29, sp",
    "stp x19, x20, [sp, #16]",
    "mov x19, x0",
    "mov x20, x1",
    "str wzr, [sp, #32]",
    "mov x0, x19",
    "bl getcontext",
    "ldr w0, [sp, #32]",
    "add w1, w0, #1",
    "str w1, [sp, #32]",
    "blr x20",
    "ldp x19, x20, [sp, #16]",
    "ldp x29, x30, [sp], #48",
    "ret",
    ".size ctxswitch_twice, .-ctxswitch_twice",
);

extern "C" {
    fn ctxswitch_twice(ctx: *mut ucontext_t, body: extern "C" fn(u32));
}

/// Port of the `getcontext(&ctx); ...; setcontext(&ctx)` idiom of `uctxswitch.c` and `uctxrestore.c`.
///
/// Calls `getcontext(ctx)`, then `body(0)`. If `body` calls `ctx.resume()`, control reappears as if
/// `getcontext` had returned again, and `body(1)` is called (then `body(2)`, and so on). Returns
/// when a `body` call returns.
///
/// # Safety
///
/// - `body` must not hold, at the point it calls [`Context::resume`], any value with a destructor, a
///   live borrow of a local, or a held lock: that frame is discarded without unwinding or dropping
///   (it is a plain-old-frame obligation, as for `longjmp`).
/// - `body` must only resume `ctx`, and only while this call is active.
/// - `body` must not unwind (it is `extern "C"`, so a panic aborts).
pub unsafe fn run_twice(ctx: &Context, body: extern "C" fn(u32)) {
    // SAFETY: `ctx.as_ptr()` is a live address-stable `ucontext_t` for the whole call (the
    // `&Context` borrow outlives it); `ctxswitch_twice(rdi/x0, rsi/x1)` has exactly this signature
    // and the stack discipline described above; the two-returns obligations are the caller's, as
    // stated in `# Safety`.
    unsafe { ctxswitch_twice(ctx.as_ptr(), body) };
}

// docs:begin printctx 1
/// Port of `print_ucontext`.
pub fn print_ucontext(c: &Context) {
    println!("-------------------------------------------");
    println!("The (incomplete) user context:");
    for (name, value) in c.registers() {
        println!("\tRegister {name}:  {value:x}");
    }
    println!("-------------------------------------------");
}
// docs:end printctx 1

/// A global `ucontext_t` variable of the C programs, as a thread local. Like a C static it starts
/// out zeroed (a blank context) and is later filled in or replaced.
pub type Global = RefCell<Rc<Context>>;

/// The initializer for a [`Global`], for `thread_local! { static X: Global = global(); }`.
pub fn global() -> Global {
    RefCell::new(Rc::new(Context::blank()))
}

/// `&g`: a handle to the context currently stored in `g`.
pub fn get_global(g: &'static LocalKey<Global>) -> Rc<Context> {
    g.with(|c| c.borrow().clone())
}

/// `getcontext(&g)`, `makecontext(&g, ..)`: store a context that was built elsewhere into `g`.
pub fn set_global(g: &'static LocalKey<Global>, ctx: Context) {
    g.with(|c| *c.borrow_mut() = Rc::new(ctx));
}

/// `swapcontext(&from, &to)` on two globals.
pub fn swapcontext(from: &'static LocalKey<Global>, to: &'static LocalKey<Global>) -> Result<(), Error> {
    let (from, to) = (get_global(from), get_global(to));
    from.swap(&to)
}
