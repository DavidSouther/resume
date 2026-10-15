//! Port of `uctxswitch.c`: getcontext, then setcontext back to it. `getcontext` returns twice, so
//! the idiom runs inside `run_twice`, which calls `body(0)` after the first return and `body(1)`
//! after the second.
use ctxswitch::uctx::{print_ucontext, run_twice, Context};

thread_local! {
    static CONTEXT: Context = Context::blank();
}

extern "C" fn body(pass: u32) {
    println!("User mode context obtained!");
    CONTEXT.with(print_ucontext);

    if pass == 0 {
        println!("Saved context by calling getcontext. ");
        func();
    } else {
        println!("Context restored by calling setcontext.");
    }
}

fn func() {
    // SAFETY: this runs inside `body`, called by `run_twice(&CONTEXT, body)` below, so `CONTEXT`
    // is the context `getcontext` filled. No value with a destructor or a borrow of a local is live
    // here: the `println!`s above have finished (their temporaries and the stdout lock are gone),
    // and the `with` closure only borrows the thread local.
    let e = CONTEXT.with(|c| unsafe { c.resume() });
    eprintln!("setcontext: {e}");
    std::process::exit(1);
}

fn main() {
    // SAFETY: `body` upholds `run_twice`'s contract (see `func`): it only resumes `CONTEXT`, while
    // `run_twice` is active, holding no destructible values; and it cannot unwind (`extern "C"`).
    CONTEXT.with(|c| unsafe { run_twice(c, body) });
}
