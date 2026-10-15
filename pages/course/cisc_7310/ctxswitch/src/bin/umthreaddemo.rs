//! Port of `umthreaddemo.c`: a non-preemptive round robin scheduler over two ucontext "threads".
use std::io::Write;
use std::rc::Rc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use ctxswitch::stack::Stack;
use ctxswitch::uctx::{Context, Error};

const STACK_SIZE: usize = 1 << 14;

static HU_EXITED: AtomicBool = AtomicBool::new(false);
static HW_EXITED: AtomicBool = AtomicBool::new(false);

thread_local! {
    static MAIN: Rc<Context> = Rc::new(Context::blank());
    static HU: Rc<Context> = Rc::new(make(hello_user));
    static HW: Rc<Context> = Rc::new(make(hello_world));
}

fn make(entry: extern "C" fn()) -> Context {
    Context::spawn(Stack::guarded(STACK_SIZE).expect("mmap stack"), entry).expect("makecontext")
}

fn yield_to_scheduler(me: &'static std::thread::LocalKey<Rc<Context>>) {
    let (me, main) = (me.with(Rc::clone), MAIN.with(Rc::clone));
    if let Err(e) = me.swap(&main) {
        eprintln!("swapcontext: {e}");
        std::process::exit(1);
    }
}

fn say(line: std::fmt::Arguments) {
    let mut out = std::io::stdout().lock();
    let _ = out.write_fmt(line);
    let _ = out.flush();
}

extern "C" fn hello_user() {
    for i in 0..20 {
        say(format_args!("[{i:03}]: Hello, User!\n"));
        std::thread::sleep(Duration::from_micros(50_000));
        // Yield to the scheduler thread.
        if !HW_EXITED.load(Ordering::SeqCst) {
            yield_to_scheduler(&HU);
        }
    }
    println!("hu exiting ...");
    HU_EXITED.store(true, Ordering::SeqCst);
    yield_to_scheduler(&HU);
}

extern "C" fn hello_world() {
    for i in 0..10 {
        say(format_args!("[{i:03}]: Hello, World!\n"));
        std::thread::sleep(Duration::from_micros(50_000));
        // Yield to the scheduler thread. (The C original tests `!hw_exited` here, which is
        // always true while this loop runs; kept for parity.)
        if !HW_EXITED.load(Ordering::SeqCst) {
            yield_to_scheduler(&HW);
        }
    }
    println!("hw exiting ...");
    HW_EXITED.store(true, Ordering::SeqCst);
    yield_to_scheduler(&HW);
}

fn main() -> Result<(), Error> {
    let (main_ctx, hu, hw) = (MAIN.with(Rc::clone), HU.with(Rc::clone), HW.with(Rc::clone));
    // The dispatch loop.
    loop {
        let (hu_done, hw_done) = (HU_EXITED.load(Ordering::SeqCst), HW_EXITED.load(Ordering::SeqCst));
        if hu_done {
            println!("The hello user thread has exited.");
        }
        if hw_done {
            println!("The hello world thread has exited.");
        }
        if hu_done && hw_done {
            break;
        }
        if !hu_done {
            main_ctx.swap(&hu)?;
        }
        if !hw_done {
            main_ctx.swap(&hw)?;
        }
    }
    Ok(())
}
