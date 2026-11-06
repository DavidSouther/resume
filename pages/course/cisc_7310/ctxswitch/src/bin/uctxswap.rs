//! Port of `uctxswap.c`: two functions swapping through swapcontext with uc_link chains.
//!
//! Comment markers: `C:` quotes the C statements a Rust line replaces when the two differ in shape,
//! `Rust only:` marks code with no C counterpart, and unmarked lines translate one to one.
use std::error::Error;

use ctxswitch::stack::Stack;
use ctxswitch::uctx::{
    get_global, global, print_ucontext, set_global, swapcontext, Context, Error as UctxError, Global,
};

// static ucontext_t uctx_main, uctx_func1, uctx_func2;
thread_local! {
    static UCTX_MAIN: Global = global();
    static UCTX_FUNC1: Global = global();
    static UCTX_FUNC2: Global = global();
}

// C: #define handle_error(msg) do { perror(msg); exit(EXIT_FAILURE); } while (0)
// Rust only: a function, taking the error `perror` would have read from `errno`.
fn handle_error(msg: &str, e: UctxError) -> ! {
    eprintln!("{msg}: {e}");
    std::process::exit(1)
}

extern "C" fn func1() {
    println!("func1: started");
    println!("func1: swapcontext(&uctx_func1, &uctx_func2)");
    if let Err(e) = swapcontext(&UCTX_FUNC1, &UCTX_FUNC2) {
        // C: == -1
        handle_error("swapcontext", e);
    }
    println!("func1: returning");
}

extern "C" fn func2() {
    println!("func2: started");
    println!("func2: swapcontext(&uctx_func2, &uctx_func1)");
    if let Err(e) = swapcontext(&UCTX_FUNC2, &UCTX_FUNC1) {
        // C: == -1
        handle_error("swapcontext", e);
    }
    println!("func2: returning");
}

fn main() -> Result<(), Box<dyn Error>> {
    let argc = std::env::args().len(); // int argc
    // C: char func1_stack[16384]; char func2_stack[16384];
    // Rust only: the stacks are `mmap`ed with a guard page where each context is built, below.
    const STACK_SIZE: usize = 16384;

    println!("Function func1 is at: {:p}", func1 as extern "C" fn());
    println!("Function func2 is at: {:p}", func2 as extern "C" fn());
    println!("Function main is at:  {:p}", main as fn() -> _);

    // C: getcontext(&uctx_func1); uctx_func1.uc_stack.ss_sp = func1_stack;
    //    uctx_func1.uc_stack.ss_size = sizeof(func1_stack); uctx_func1.uc_link = &uctx_main;
    //    makecontext(&uctx_func1, func1, 0);
    // Rust only: `spawn_linked` does all of that in one call, and `?` stands in for
    // `if (getcontext(..) == -1) handle_error("getcontext");`.
    // SAFETY (uc_link contract): when `func1` returns, glibc enters `UCTX_MAIN`; at that point
    // `main` is suspended inside the `swapcontext(&UCTX_MAIN, &UCTX_FUNC2)` below (it never returns
    // before `func1` ends the chain), so its saved frame is live and its state valid. Nothing swaps
    // to `UCTX_MAIN` after.
    let uctx_func1 =
        unsafe { Context::spawn_linked(Stack::guarded(STACK_SIZE)?, get_global(&UCTX_MAIN), func1)? };
    set_global(&UCTX_FUNC1, uctx_func1); // Rust only: store it in the global
    println!("Func1 ucontext: -----------------------");
    print_ucontext(&get_global(&UCTX_FUNC1));

    // C: getcontext(&uctx_func2); uctx_func2.uc_stack.ss_sp = func2_stack;
    //    uctx_func2.uc_stack.ss_size = sizeof(func2_stack);
    //    /* Successor context is f1(), unless argc > 1 */
    //    uctx_func2.uc_link = (argc > 1) ? NULL : &uctx_func1;
    //    makecontext(&uctx_func2, func2, 0);
    let uctx_func2 = if argc > 1 {
        Context::spawn(Stack::guarded(STACK_SIZE)?, func2)?
    } else {
        // SAFETY (uc_link contract): `func2` returns only after its own `swapcontext(func2 -> func1)`
        // resumed it. At that moment `func1` is suspended in its `swapcontext(func1 -> func2)`, so
        // `UCTX_FUNC1`'s saved state is live and valid, and glibc enters it once. Nothing swaps to
        // it afterwards.
        unsafe { Context::spawn_linked(Stack::guarded(STACK_SIZE)?, get_global(&UCTX_FUNC1), func2)? }
    };
    set_global(&UCTX_FUNC2, uctx_func2); // Rust only: store it in the global
    println!("Func2 ucontext: -----------------------");
    print_ucontext(&get_global(&UCTX_FUNC2));

    println!("main: swapcontext(&uctx_main, &uctx_func2)");
    if let Err(e) = swapcontext(&UCTX_MAIN, &UCTX_FUNC2) {
        // C: == -1
        handle_error("swapcontext", e);
    }

    println!("main: exiting");
    std::process::exit(0); // exit(EXIT_SUCCESS);
}
