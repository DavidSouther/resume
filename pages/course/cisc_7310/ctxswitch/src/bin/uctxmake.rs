//! Port of `uctxmake.c`: getcontext, give the context a fresh stack, makecontext, setcontext.
//!
//! Comment markers: `C:` quotes the C statements a Rust line replaces when the two differ in shape,
//! `Rust only:` marks code with no C counterpart, and unmarked lines translate one to one.
use std::cell::OnceCell;
use std::error::Error;

use ctxswitch::stack::Stack;
use ctxswitch::uctx::{print_ucontext, Context};

const STACK_SIZE: usize = 1 << 14; // #define STACK_SIZE (1 << 14)

// Rust only: no forward declarations of `hello_user` and `make_hu_context` are needed.

thread_local! {
    // ucontext_t hu_context;
    static HU_CONTEXT: OnceCell<Context> = const { OnceCell::new() };
}

fn main() -> Result<(), Box<dyn Error>> {
    // C: #ifdef __x86_64__ printf("... %lp\n", ..) #else printf("... %p\n", ..) #endif
    println!("hello_user is at {:p}", hello_user as extern "C" fn());
    make_hu_context()?;
    // C: setcontext(&hu_context); return 0;
    // Rust only: `setcontext` returns only on failure, so `enter` returns the error. On success
    // `hello_user` returns into glibc, which ends the process (`uc_link` is null), as in C.
    let e = HU_CONTEXT.with(|hu_context| hu_context.get().expect("make_hu_context ran").enter());
    Err(e.into())
}

extern "C" fn hello_user() {
    println!("From hello_user: Hello, User!");
}

fn make_hu_context() -> Result<(), Box<dyn Error>> {
    let mut hu_context = Context::captured()?; // getcontext(&hu_context);
    println!("Newly obtained hu_context:");
    print_ucontext(&hu_context);

    // C: hu_context.uc_stack.ss_sp = malloc(STACK_SIZE);
    //    hu_context.uc_stack.ss_size = STACK_SIZE;
    //    makecontext(&hu_context, hello_user, 0);
    // Rust only: the stack is `mmap`ed with a guard page instead of `malloc`ed, and `bind` sets
    // `ss_sp`, `ss_size` and calls `makecontext` as one step.
    hu_context.bind(Stack::guarded(STACK_SIZE)?, hello_user)?;
    println!("hu_context made via makecontext:");
    print_ucontext(&hu_context);

    // Rust only: C wrote into the global in place; this moves the finished context into it.
    HU_CONTEXT.with(|global| global.set(hu_context).map_err(|_| "hu_context already made"))?;
    Ok(())
}
