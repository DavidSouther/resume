//! User-level mechanisms switch between two flows of control on one thread. glibc's
//! `swapcontext` makes system calls; the other switches make none.

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use super::{measure, pin_to_first_cpu, Error, Plan, Sample, WorkingSet};
use crate::green;
use crate::regswitch::Fiber;
use crate::stack::Stack;
use crate::uctx::Context;

const PEER_STACK: usize = 64 * 1024;

thread_local! {
    static WS_BYTES: Cell<usize> = const { Cell::new(0) };
    static STRIDE: Cell<usize> = const { Cell::new(64) };
    static READ_ONLY: Cell<bool> = const { Cell::new(false) };
    static UCTX: RefCell<Option<(Rc<Context>, Rc<Context>)>> = const { RefCell::new(None) };
    static FIBERS: RefCell<Option<(Rc<Fiber>, Rc<Fiber>)>> = const { RefCell::new(None) };
}

extern "C" fn ucontext_peer() {
    let (main, me) = UCTX.with(|u| u.borrow().clone().expect("pair installed"));
    let mut ws = WorkingSet::new(WS_BYTES.with(Cell::get), STRIDE.with(Cell::get), READ_ONLY.with(Cell::get));
    loop {
        ws.touch();
        if me.swap(&main).is_err() {
            std::process::abort();
        }
    }
}

pub fn ucontext(plan: &Plan) -> Result<Sample, Error> {
    pin_to_first_cpu()?;
    WS_BYTES.with(|w| w.set(plan.working_set));
    STRIDE.with(|s| s.set(plan.stride));
    READ_ONLY.with(|r| r.set(plan.read_only));
    let main = Rc::new(Context::blank());
    let peer = Rc::new(Context::spawn(Stack::guarded(PEER_STACK)?, ucontext_peer)?);
    UCTX.with(|u| *u.borrow_mut() = Some((main.clone(), peer.clone())));
    let mut ws = WorkingSet::new(plan.working_set, plan.stride, plan.read_only);
    measure(plan, None, || {
        for _ in 0..plan.switches / 2 {
            ws.touch();
            main.swap(&peer)?;
        }
        Ok(())
    })
}

extern "C" fn fiber_peer() {
    let (main, me) = FIBERS.with(|f| f.borrow().clone().expect("pair installed"));
    let mut ws = WorkingSet::new(WS_BYTES.with(Cell::get), STRIDE.with(Cell::get), READ_ONLY.with(Cell::get));
    loop {
        ws.touch();
        if me.switch(&main).is_err() {
            std::process::abort();
        }
    }
}

pub fn regswitch(plan: &Plan) -> Result<Sample, Error> {
    pin_to_first_cpu()?;
    WS_BYTES.with(|w| w.set(plan.working_set));
    STRIDE.with(|s| s.set(plan.stride));
    READ_ONLY.with(|r| r.set(plan.read_only));
    let main = Rc::new(Fiber::current());
    let peer = Rc::new(Fiber::new(Stack::guarded(PEER_STACK)?, fiber_peer)?);
    FIBERS.with(|f| *f.borrow_mut() = Some((main.clone(), peer.clone())));
    let mut ws = WorkingSet::new(plan.working_set, plan.stride, plan.read_only);
    measure(plan, None, || {
        for _ in 0..plan.switches / 2 {
            ws.touch();
            main.switch(&peer)?;
        }
        Ok(())
    })
}

/// Two green tasks yield to each other. Each handoff goes through the scheduler and includes two
/// fiber switches and queue work.
pub fn green(plan: &Plan) -> Result<Sample, Error> {
    pin_to_first_cpu()?;
    let (bytes, stride, read_only) = (plan.working_set, plan.stride, plan.read_only);
    let stop = Rc::new(Cell::new(false));
    for _ in 0..2 {
        let stop = stop.clone();
        green::spawn(move || {
            let mut ws = WorkingSet::new(bytes, stride, read_only);
            while !stop.get() {
                ws.touch();
                green::yield_now();
            }
        })?;
    }
    // Initialize both stacks and working sets outside the measured repetitions.
    green::run_steps(2);
    let steps = usize::try_from(plan.switches)
        .map_err(|_| Error::Usage("switch count too large".into()))?;
    let result = measure(plan, None, || {
        green::run_steps(steps);
        Ok(())
    });
    stop.set(true);
    green::run();
    result
}
