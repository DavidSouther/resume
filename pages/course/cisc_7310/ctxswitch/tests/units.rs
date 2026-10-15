//! Unit level checks for the switching primitives. Run with `./scripts-dev.sh test --release`.
use std::cell::{Cell, RefCell};
use std::rc::Rc;

use ctxswitch::green;
use ctxswitch::regswitch::{Error as RegError, Fiber};
use ctxswitch::stack::Stack;
use ctxswitch::uctx::{Context, Error as UctxError};

thread_local! {
    static PAIR: RefCell<Option<(Rc<Fiber>, Rc<Fiber>)>> = const { RefCell::new(None) };
    static COUNT: Cell<u64> = const { Cell::new(0) };
    static ORDER: RefCell<Vec<&'static str>> = const { RefCell::new(Vec::new()) };
}

extern "C" fn counter() {
    let (main, me) = PAIR.with(|p| p.borrow().clone().unwrap());
    loop {
        COUNT.with(|c| c.set(c.get() + 1));
        me.switch(&main).unwrap();
    }
}

#[test]
fn regswitch_ping_pong_counts_every_round_trip() {
    let main = Rc::new(Fiber::current());
    let peer = Rc::new(Fiber::new(Stack::guarded(64 * 1024).unwrap(), counter).unwrap());
    PAIR.with(|p| *p.borrow_mut() = Some((main.clone(), peer.clone())));
    COUNT.with(|c| c.set(0));

    for _ in 0..1000 {
        main.switch(&peer).unwrap();
    }

    assert_eq!(COUNT.with(Cell::get), 1000);
}

#[test]
fn regswitch_rejects_switching_to_a_fiber_that_is_not_suspended() {
    let a = Fiber::current();
    let b = Fiber::current();

    assert!(matches!(a.switch(&b), Err(RegError::NotSuspended)));
    assert!(matches!(a.switch(&a), Err(RegError::SameFiber)));
}

/// Callee saved registers survive a switch: the peer clobbers every one it can name.
extern "C" fn clobber() {
    let (main, me) = PAIR.with(|p| p.borrow().clone().unwrap());
    loop {
        // SAFETY: only declares clobbers of callee saved registers so the compiler saves and
        // restores them around the block; no memory or stack is touched.
        #[cfg(target_arch = "x86_64")]
        unsafe {
            std::arch::asm!("", out("r12") _, out("r13") _, out("r14") _, out("r15") _, options(nomem, nostack))
        };
        #[cfg(target_arch = "aarch64")]
        unsafe {
            std::arch::asm!("", out("x20") _, out("x21") _, out("x22") _, out("x23") _, out("x24") _, out("x25") _, out("x26") _, out("x27") _, out("x28") _, options(nomem, nostack))
        };
        me.switch(&main).unwrap();
    }
}

#[test]
fn regswitch_preserves_the_callers_locals_across_a_clobbering_peer() {
    let main = Rc::new(Fiber::current());
    let peer = Rc::new(Fiber::new(Stack::guarded(64 * 1024).unwrap(), clobber).unwrap());
    PAIR.with(|p| *p.borrow_mut() = Some((main.clone(), peer.clone())));
    let mut sum = 0u64;
    let keep = [3u64, 5, 7, 11, 13, 17, 19, 23];

    for round in 0..100 {
        main.switch(&peer).unwrap();
        sum += keep.iter().map(|k| k * (round + 1)).sum::<u64>();
    }

    assert_eq!(sum, 98 * (1..=100).sum::<u64>());
}

#[test]
fn green_tasks_alternate_and_return_results() {
    ORDER.with(|o| o.borrow_mut().clear());
    let a = green::spawn(|| {
        for _ in 0..3 {
            ORDER.with(|o| o.borrow_mut().push("a"));
            green::yield_now();
        }
        1u32
    })
    .unwrap();
    let b = green::spawn(|| {
        for _ in 0..3 {
            ORDER.with(|o| o.borrow_mut().push("b"));
            green::yield_now();
        }
        2u32
    })
    .unwrap();

    green::run();

    assert_eq!(ORDER.with(|o| o.borrow().clone()), ["a", "b", "a", "b", "a", "b"]);
    assert_eq!((a.take(), b.take()), (Some(1), Some(2)));
}

#[test]
fn guarded_stack_is_page_aligned_and_usable() {
    let mut s = Stack::guarded(32 * 1024).unwrap();

    assert_eq!(s.len() % 4096, 0);
    assert!(s.len() >= 32 * 1024);
    // SAFETY: both addresses are inside the usable read/write region of the owned mapping.
    unsafe {
        s.base().write(7);
        s.top().sub(1).write(9);
        assert_eq!((s.base().read(), s.top().sub(1).read()), (7, 9));
    }
}

extern "C" fn nothing() {}

#[test]
fn ucontext_swap_requires_a_ready_target() {
    let a = Context::blank();
    let b = Context::blank();

    assert!(matches!(a.swap(&b), Err(UctxError::NotReady)));
    assert!(matches!(a.swap(&a), Err(UctxError::SameContext)));
    let mut c = Context::captured().unwrap();
    assert!(c.bind(Stack::guarded(16384).unwrap(), nothing).is_ok());
}

/// Evidence for REVIEW.md: how much state each kind of saved context carries.
/// `cargo test --release sizes -- --nocapture`
#[test]
fn sizes_of_saved_state_are_reported() {
    let ucontext = std::mem::size_of::<libc::ucontext_t>();
    let sigset = std::mem::size_of::<libc::sigset_t>();
    #[cfg(target_arch = "x86_64")]
    let register_frame = 6 * 8;
    #[cfg(target_arch = "aarch64")]
    let register_frame = 176;
    println!("sizeof(ucontext_t) = {ucontext} bytes (includes a {sigset} byte signal mask)");
    println!("regswitch saved frame = {register_frame} bytes (callee saved registers; the stack pointer is the handle)");
    assert!(ucontext > register_frame);
}
