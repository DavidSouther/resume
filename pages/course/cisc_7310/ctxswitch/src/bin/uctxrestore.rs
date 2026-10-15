//! Port of `uctxrestore.c`: restores to a context taken before its own `sleep(1)`, forever. The
//! line after `setcontext` in the C original is unreachable by design.
use std::time::Duration;

use ctxswitch::uctx::{run_twice, Context};

thread_local! {
    static CURR: Context = Context::blank();
}

extern "C" fn body(_pass: u32) {
    println!("After getcontext: Hello, World!");
    std::thread::sleep(Duration::from_secs(1));
    // SAFETY: called from `body` under `run_twice(&CURR, body)`, so `CURR` is the context
    // `getcontext` filled; the `println!` has finished (no stdout lock, no temporaries live), the
    // sleep has returned, and the `with` closure only borrows the thread local.
    let e = CURR.with(|c| unsafe { c.resume() });
    eprintln!("setcontext: {e}");
    println!("After setcontext: Hello, World!");
}

fn main() {
    // SAFETY: `body` upholds `run_twice`'s contract as described above, and cannot unwind.
    CURR.with(|c| unsafe { run_twice(c, body) });
}
