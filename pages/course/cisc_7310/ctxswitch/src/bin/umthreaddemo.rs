//! Port of `umthreaddemo.c`: a non-preemptive round robin scheduler over two ucontext "threads".
//!
//! Comment markers: `C:` quotes the C statements a Rust line replaces when the two differ in shape,
//! `Rust only:` marks code with no C counterpart, and unmarked lines translate one to one.
use std::error::Error;
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::LocalKey;
use std::time::Duration;

use ctxswitch::stack::Stack;
use ctxswitch::uctx::{global, set_global, swapcontext, Context, Global};

const STACK_SIZE: usize = 1 << 14; // #define STACK_SIZE (1 << 14)

// Rust only: no forward declarations of the four helper functions are needed.

// static ucontext_t m_context, hu_context, hw_context, main_context;
// C: `m_context` is never used, so it is left out.
thread_local! {
    static HU_CONTEXT: Global = global();
    static HW_CONTEXT: Global = global();
    static MAIN_CONTEXT: Global = global();
}
// static int hu_exited = 0, hw_exited = 0;
static HU_EXITED: AtomicBool = AtomicBool::new(false);
static HW_EXITED: AtomicBool = AtomicBool::new(false);

// Rust only: the C ignores the result of `swapcontext`; a failure here would hang or crash it, so
// this port stops with a message instead.
fn swap(from: &'static LocalKey<Global>, to: &'static LocalKey<Global>) {
    if let Err(e) = swapcontext(from, to) {
        eprintln!("swapcontext: {e}");
        std::process::exit(1);
    }
}

fn main() -> Result<(), Box<dyn Error>> {
    make_hu_context()?;
    make_hw_context()?;

    /* A simple non-preemptive round robin scheduler:
     * Below is the main dispatch loop */
    loop {
        // while (1)
        if HU_EXITED.load(Ordering::SeqCst) {
            println!("The hello user thread has exited.");
        }
        if HW_EXITED.load(Ordering::SeqCst) {
            println!("The hello world thread has exited.");
        }

        /* no more threds to schedule */
        if HW_EXITED.load(Ordering::SeqCst) && HU_EXITED.load(Ordering::SeqCst) {
            break;
        }

        /* dispatch the hello user thread to CPU */
        if !HU_EXITED.load(Ordering::SeqCst) {
            swap(&MAIN_CONTEXT, &HU_CONTEXT); // swapcontext(&main_context, &hu_context);
        }

        /* dispatch the hellow world thread to CPU */
        if !HW_EXITED.load(Ordering::SeqCst) {
            swap(&MAIN_CONTEXT, &HW_CONTEXT); // swapcontext(&main_context, &hw_context);
        }
    }

    Ok(()) // return 0;
}

extern "C" fn hello_user() {
    for i in 0..20 {
        // for (int i = 0; i < 20; i++)
        println!("[{i:03}]: Hello, User!");
        let _ = std::io::stdout().flush(); // fflush(stdout);
        std::thread::sleep(Duration::from_micros(50_000)); // usleep(50000);

        /* yeild to the scheduler thread */
        if !HW_EXITED.load(Ordering::SeqCst) {
            swap(&HU_CONTEXT, &MAIN_CONTEXT); // swapcontext(&hu_context, &main_context);
        }
    }

    /* yeild to the scheduler thread */
    println!("hu exiting ...");
    HU_EXITED.store(true, Ordering::SeqCst); // hu_exited = 1;
    swap(&HU_CONTEXT, &MAIN_CONTEXT); // swapcontext(&hu_context, &main_context);
}

extern "C" fn hello_world() {
    for i in 0..10 {
        // for (int i = 0; i < 10; i++)
        println!("[{i:03}]: Hello, World!");
        let _ = std::io::stdout().flush(); // fflush(stdout);
        std::thread::sleep(Duration::from_micros(50_000)); // usleep(50000);

        /* yeild to the scheduler thread */
        // The C original tests `!hw_exited` here, which is always true while this loop runs; kept.
        if !HW_EXITED.load(Ordering::SeqCst) {
            swap(&HW_CONTEXT, &MAIN_CONTEXT); // swapcontext(&hw_context, &main_context);
        }
    }

    /* yeild to the scheduler thread */
    println!("hw exiting ...");
    HW_EXITED.store(true, Ordering::SeqCst); // hw_exited = 1;
    swap(&HW_CONTEXT, &MAIN_CONTEXT); // swapcontext(&hw_context, &main_context);
}

fn make_hu_context() -> Result<(), Box<dyn Error>> {
    let mut hu_context = Context::captured()?; // getcontext(&hu_context);

    // C: hu_context.uc_stack.ss_sp = malloc(STACK_SIZE);
    //    hu_context.uc_stack.ss_size = STACK_SIZE;
    //    makecontext(&hu_context, hello_user, 0);
    // Rust only: `mmap`ed guarded stack; `bind` does all three steps.
    hu_context.bind(Stack::guarded(STACK_SIZE)?, hello_user)?;
    set_global(&HU_CONTEXT, hu_context); // Rust only: store it in the global
    Ok(())
}

fn make_hw_context() -> Result<(), Box<dyn Error>> {
    let mut hw_context = Context::captured()?; // getcontext(&hw_context);

    // C: hw_context.uc_stack.ss_sp = malloc(STACK_SIZE);
    //    hw_context.uc_stack.ss_size = STACK_SIZE;
    //    makecontext(&hw_context, hello_world, 0);
    // Rust only: `mmap`ed guarded stack; `bind` does all three steps.
    hw_context.bind(Stack::guarded(STACK_SIZE)?, hello_world)?;
    set_global(&HW_CONTEXT, hw_context); // Rust only: store it in the global
    Ok(())
}
