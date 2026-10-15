//! Port of `uctxmake.c`: getcontext, give the context a fresh stack, makecontext, setcontext.
use ctxswitch::stack::Stack;
use ctxswitch::uctx::{print_ucontext, Context};

const STACK_SIZE: usize = 1 << 14;

extern "C" fn hello_user() {
    println!("From hello_user: Hello, User!");
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("hello_user is at {:p}", hello_user as extern "C" fn());
    let mut hu = Context::captured()?;
    println!("Newly obtained hu_context:");
    print_ucontext(&hu);
    hu.bind(Stack::guarded(STACK_SIZE)?, hello_user)?;
    println!("hu_context made via makecontext:");
    print_ucontext(&hu);
    // Returning from `hello_user` has no successor (uc_link is null), which ends the process.
    Err(hu.enter().into())
}
