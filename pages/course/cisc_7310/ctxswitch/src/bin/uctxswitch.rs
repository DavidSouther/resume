//! Port of `uctxswitch.c`: getcontext, then setcontext back to it.
//!
//! Reading guide, shared by all ports. Items keep the C order and names. A comment that starts with
//! `C:` quotes the C statements a Rust line replaces when the two differ in shape. A comment that
//! starts with `Rust only:` marks code with no C counterpart. Unmarked lines translate one to one.
use std::sync::atomic::{AtomicI32, Ordering};

use ctxswitch::uctx::{print_ucontext, run_twice, Context};

// Rust only: no forward declaration of `func` is needed.

static CTX: AtomicI32 = AtomicI32::new(0); // int ctx = 0;
thread_local! {
    static CONTEXT: Context = Context::blank(); // ucontext_t context, *cp = &context;
}

fn main() {
    // C: getcontext(cp); and every statement after it in `main`.
    // Rust only: `getcontext` returns twice, which Rust cannot express. `run_twice` calls
    // `getcontext(cp)` and then `main_after_getcontext` once per return, so that function holds the
    // rest of C `main`.
    // SAFETY: `main_after_getcontext` upholds `run_twice`'s contract (see `func`): it only resumes
    // `CONTEXT`, while `run_twice` is active, holding no destructible values; and it cannot unwind
    // (`extern "C"`).
    CONTEXT.with(|cp| unsafe { run_twice(cp, main_after_getcontext) });
}

// Rust only: the statements of C `main` that follow `getcontext(cp);`. The argument counts the
// returns of `getcontext`; C tells them apart with `ctx`, and so does this port.
extern "C" fn main_after_getcontext(_returns: u32) {
    println!("User mode context obtained!");
    CONTEXT.with(print_ucontext); // print_ucontext(cp);

    if CTX.load(Ordering::SeqCst) == 0 {
        // if (!ctx)
        println!("Saved context by calling getcontext. ");
        func();
    } else {
        println!("Context restored by calling setcontext.");
    }
}

fn func() {
    CTX.fetch_add(1, Ordering::SeqCst); // ctx++;
    // C: setcontext(cp);
    // SAFETY: this runs inside `main_after_getcontext`, called by `run_twice(&CONTEXT, ..)`, so
    // `CONTEXT` is the context `getcontext` filled. No value with a destructor or a borrow of a
    // local is live here: the `println!`s above have finished (their temporaries and the stdout
    // lock are gone), and the `with` closure only borrows the thread local.
    let e = CONTEXT.with(|cp| unsafe { cp.resume() });
    // Rust only: `setcontext` returns only on failure.
    eprintln!("setcontext: {e}");
    std::process::exit(1);
}
