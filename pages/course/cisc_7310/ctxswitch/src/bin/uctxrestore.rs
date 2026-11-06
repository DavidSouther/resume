//! Port of `uctxrestore.c`: restores to a context taken before its own `sleep(1)`, forever. The
//! line after `setcontext` in the C original is unreachable unless `setcontext` fails.
//!
//! Comment markers: `C:` quotes the C statements a Rust line replaces when the two differ in shape,
//! `Rust only:` marks code with no C counterpart, and unmarked lines translate one to one.
use std::time::Duration;

use ctxswitch::uctx::{run_twice, Context};

thread_local! {
    // Rust only: C declares `ucontext_t curr;` as a local of `main`. The code after `getcontext`
    // lives in another function here, so the context is a global.
    static CURR: Context = Context::blank();
}

fn main() {
    // C: getcontext(&curr); and every statement after it in `main`. `run_twice` calls
    // `getcontext(&CURR)` and then `main_after_getcontext` once per return.
    // SAFETY: `main_after_getcontext` upholds `run_twice`'s contract: it only resumes `CURR`, while
    // `run_twice` is active, holding no destructible values; and it cannot unwind (`extern "C"`).
    CURR.with(|curr| unsafe { run_twice(curr, main_after_getcontext) });
}

// Rust only: the statements of C `main` that follow `getcontext(&curr);`.
extern "C" fn main_after_getcontext(_returns: u32) {
    println!("After getcontext: Hello, World!"); // puts(...)
    std::thread::sleep(Duration::from_secs(1)); // sleep(1);
    // C: setcontext(&curr);
    // SAFETY: called under `run_twice(&CURR, ..)`, so `CURR` is the context `getcontext` filled;
    // the `println!` has finished (no stdout lock, no temporaries live), the sleep has returned,
    // and the `with` closure only borrows the thread local.
    let e = CURR.with(|curr| unsafe { curr.resume() });
    // Rust only: `setcontext` returns only on failure, so this line is the only way to see the next.
    eprintln!("setcontext: {e}");
    println!("After setcontext: Hello, World!"); // puts(...)
    // C: return 0; (the function returning ends `run_twice`, and so `main`)
}
