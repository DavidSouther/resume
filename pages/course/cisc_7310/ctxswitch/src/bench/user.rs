//! The user-level mechanisms: two flows of control in one thread, no kernel involvement beyond
//! whatever the switch itself calls (glibc's `swapcontext` makes one system call, the others none).

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use super::{measure, pin_to_first_cpu, Error, Plan, WorkingSet};
use crate::green;
use crate::regswitch::Fiber;
use crate::stack::Stack;
use crate::uctx::Context;

const PEER_STACK: usize = 64 * 1024;

thread_local! {
    static WS_BYTES: Cell<usize> = const { Cell::new(0) };
    static UCTX: RefCell<Option<(Rc<Context>, Rc<Context>)>> = const { RefCell::new(None) };
    static FIBERS: RefCell<Option<(Rc<Fiber>, Rc<Fiber>)>> = const { RefCell::new(None) };
}

extern "C" fn ucontext_peer() {
    let (main, me) = UCTX.with(|u| u.borrow().clone().expect("pair installed"));
    let mut ws = WorkingSet::new(WS_BYTES.with(Cell::get));
    loop {
        ws.touch();
        if me.swap(&main).is_err() {
            std::process::abort();
        }
    }
}

pub fn ucontext(plan: &Plan) -> Result<f64, Error> {
    pin_to_first_cpu()?;
    WS_BYTES.with(|w| w.set(plan.working_set));
    let main = Rc::new(Context::blank());
    let peer = Rc::new(Context::spawn(Stack::guarded(PEER_STACK)?, ucontext_peer)?);
    UCTX.with(|u| *u.borrow_mut() = Some((main.clone(), peer.clone())));
    let mut ws = WorkingSet::new(plan.working_set);
    measure(plan, || {
        for _ in 0..plan.switches / 2 {
            ws.touch();
            main.swap(&peer)?;
        }
        Ok(())
    })
}

extern "C" fn fiber_peer() {
    let (main, me) = FIBERS.with(|f| f.borrow().clone().expect("pair installed"));
    let mut ws = WorkingSet::new(WS_BYTES.with(Cell::get));
    loop {
        ws.touch();
        if me.switch(&main).is_err() {
            std::process::abort();
        }
    }
}

pub fn regswitch(plan: &Plan) -> Result<f64, Error> {
    pin_to_first_cpu()?;
    WS_BYTES.with(|w| w.set(plan.working_set));
    let main = Rc::new(Fiber::current());
    let peer = Rc::new(Fiber::new(Stack::guarded(PEER_STACK)?, fiber_peer)?);
    FIBERS.with(|f| *f.borrow_mut() = Some((main.clone(), peer.clone())));
    let mut ws = WorkingSet::new(plan.working_set);
    measure(plan, || {
        for _ in 0..plan.switches / 2 {
            ws.touch();
            main.switch(&peer)?;
        }
        Ok(())
    })
}

/// Two green tasks that yield to each other. One handoff goes task, scheduler, task: two raw
/// switches plus run queue work, which is what a green thread library pays per task switch.
pub fn green(plan: &Plan) -> Result<f64, Error> {
    pin_to_first_cpu()?;
    let (switches, bytes) = (plan.switches, plan.working_set);
    measure(plan, || {
        for _ in 0..2 {
            green::spawn(move || {
                let mut ws = WorkingSet::new(bytes);
                for _ in 0..switches / 2 {
                    ws.touch();
                    green::yield_now();
                }
            })?;
        }
        green::run();
        Ok(())
    })
}
