//! Port of `uctxswap.c`: two functions swapping through swapcontext with uc_link chains.
use std::cell::RefCell;
use std::process::ExitCode;
use std::rc::Rc;

use ctxswitch::stack::Stack;
use ctxswitch::uctx::{print_ucontext, Context, Error};

const STACK_SIZE: usize = 16384;

thread_local! {
    static MAIN: Rc<Context> = Rc::new(Context::blank());
    static FUNC1: RefCell<Option<Rc<Context>>> = const { RefCell::new(None) };
    static FUNC2: RefCell<Option<Rc<Context>>> = const { RefCell::new(None) };
}

fn get(slot: &'static std::thread::LocalKey<RefCell<Option<Rc<Context>>>>) -> Rc<Context> {
    slot.with(|c| c.borrow().clone().expect("context installed before first swap"))
}

fn handle(e: Error) -> ! {
    eprintln!("swapcontext: {e}");
    std::process::exit(1)
}

extern "C" fn func1() {
    println!("func1: started");
    println!("func1: swapcontext(&uctx_func1, &uctx_func2)");
    let (a, b) = (get(&FUNC1), get(&FUNC2));
    if let Err(e) = a.swap(&b) {
        handle(e);
    }
    println!("func1: returning");
}

extern "C" fn func2() {
    println!("func2: started");
    println!("func2: swapcontext(&uctx_func2, &uctx_func1)");
    let (a, b) = (get(&FUNC2), get(&FUNC1));
    if let Err(e) = a.swap(&b) {
        handle(e);
    }
    println!("func2: returning");
}

fn main() -> Result<ExitCode, Box<dyn std::error::Error>> {
    let no_link = std::env::args().len() > 1;
    println!("Function func1 is at: {:p}", func1 as extern "C" fn());
    println!("Function func2 is at: {:p}", func2 as extern "C" fn());
    println!("Function main is at:  {:p}", main as fn() -> _);

    let main_ctx = MAIN.with(Rc::clone);

    // SAFETY (uc_link contract): when `func1` returns, glibc enters `main_ctx`; at that point
    // `main` is suspended inside `m.swap(&c2)` below (it never returns before `func1` ends the
    // chain), so its saved frame is live and its state valid. Nothing swaps to `main_ctx` after.
    let c1 = Rc::new(unsafe { Context::spawn_linked(Stack::guarded(STACK_SIZE)?, main_ctx, func1)? });
    FUNC1.with(|c| *c.borrow_mut() = Some(c1.clone()));
    println!("Func1 ucontext: -----------------------");
    print_ucontext(&c1);

    // Successor context is func1, unless an argument was given.
    let c2 = Rc::new(if no_link {
        Context::spawn(Stack::guarded(STACK_SIZE)?, func2)?
    } else {
        // SAFETY (uc_link contract): `func2` returns only after its own `swap(func2 -> func1)`
        // resumed it. At that moment `func1` is suspended in its `swap(func1 -> func2)`, so
        // `c1`'s saved state is live and valid, and glibc enters it once. Nothing swaps to `c1`
        // afterwards.
        unsafe { Context::spawn_linked(Stack::guarded(STACK_SIZE)?, c1.clone(), func2)? }
    });
    FUNC2.with(|c| *c.borrow_mut() = Some(c2.clone()));
    println!("Func2 ucontext: -----------------------");
    print_ucontext(&c2);

    println!("main: swapcontext(&uctx_main, &uctx_func2)");
    let m = MAIN.with(Rc::clone);
    m.swap(&c2)?;
    println!("main: exiting");
    Ok(ExitCode::SUCCESS)
}
