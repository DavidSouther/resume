//! Green threads: a run queue and `yield_now` on top of the register-only [`Fiber`] switch, on
//! guarded 32 KiB stacks, inside one worker thread (so the kernel sees one schedulable task).
//!
//! The shape (spawn / yield_now / join, a scheduler loop that dispatches tasks, tasks pinned to
//! the worker that started them, 32 KiB `mmap`ed stacks with a guard page) follows Dzania's
//! "Green Threads from Scratch" (https://dzania.github.io/green-threads-from-scratch/) and the
//! `rsroutine` repository (https://github.com/dzania/rsroutine). `rsroutine` declares no license
//! and targets Apple Silicon macOS, so nothing is copied: this is an independent implementation
//! for Linux. The article's M:N work stealing across worker threads is deliberately omitted; a
//! second worker would add a second kernel task, which is not what this experiment measures.
//! `join` is reduced to [`JoinHandle::take`] after [`run`] has drained the queue.

use std::cell::{Cell, RefCell};
use std::collections::VecDeque;
use std::io;
use std::rc::Rc;

use crate::regswitch::{self, Fiber};
use crate::stack::Stack;

/// Usable stack bytes per task, as in the article.
pub const STACK_SIZE: usize = 32 * 1024;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("stack allocation failed: {0}")]
    Stack(#[from] io::Error),
    #[error(transparent)]
    Switch(#[from] regswitch::Error),
}

struct Task {
    fiber: Fiber,
    body: RefCell<Option<Box<dyn FnOnce()>>>,
    done: Cell<bool>,
}

struct State {
    queue: RefCell<VecDeque<Rc<Task>>>,
    /// The task being run by the scheduler right now, if any.
    running: RefCell<Option<Rc<Task>>>,
    sched: Fiber,
}

thread_local! {
    static STATE: State = State {
        queue: RefCell::new(VecDeque::new()),
        running: RefCell::new(None),
        sched: Fiber::current(),
    };
}

/// Result slot of a spawned task.
pub struct JoinHandle<T> {
    slot: Rc<RefCell<Option<T>>>,
}

impl<T> JoinHandle<T> {
    /// The task's return value, once [`run`] has run it to completion.
    pub fn take(&self) -> Option<T> {
        self.slot.borrow_mut().take()
    }
}

/// Queue a new task. It starts when [`run`] reaches it.
pub fn spawn<T: 'static>(f: impl FnOnce() -> T + 'static) -> Result<JoinHandle<T>, Error> {
    let slot = Rc::new(RefCell::new(None));
    let out = slot.clone();
    let body: Box<dyn FnOnce()> = Box::new(move || *out.borrow_mut() = Some(f()));
    let task = Rc::new(Task {
        fiber: Fiber::new(Stack::guarded(STACK_SIZE)?, task_main)?,
        body: RefCell::new(Some(body)),
        done: Cell::new(false),
    });
    STATE.with(|s| s.queue.borrow_mut().push_back(task));
    Ok(JoinHandle { slot })
}

/// Put the calling task at the back of the queue and let the scheduler pick the next one.
/// Must be called from inside a task.
pub fn yield_now() {
    STATE.with(|s| {
        let me = s.running.borrow().clone().expect("yield_now called outside a task");
        s.queue.borrow_mut().push_back(me.clone());
        me.fiber.switch(&s.sched).expect("scheduler fiber is suspended while a task runs");
    });
}

/// The scheduler: dispatch tasks in FIFO order until none are left. Not callable from inside a task.
///
/// Invariant relied on by `task_main`: while a task executes, this frame holds `task`, a strong
/// `Rc<Task>`, and does not return until the task's `sched.switch` returns here.
pub fn run() {
    STATE.with(|s| loop {
        assert!(s.running.borrow().is_none(), "green::run called from inside a task");
        let Some(task) = s.queue.borrow_mut().pop_front() else { break };
        *s.running.borrow_mut() = Some(task.clone());
        s.sched.switch(&task.fiber).expect("queued task is suspended");
        *s.running.borrow_mut() = None;
        // `task` (the scheduler's strong reference) drops here; a finished task frees its stack.
    });
}

extern "C" fn task_main() {
    let task = STATE.with(|s| s.running.borrow().clone().expect("task started by the scheduler"));
    let body = task.body.borrow_mut().take().expect("task body present at first start");
    body();
    task.done.set(true);
    let fiber: *const Fiber = &task.fiber;
    drop(task); // no other owner-needing value remains on this stack: the next switch never returns here
    STATE.with(|s| {
        // SAFETY: `fiber` points into the `Task` allocation. `run()` holds a strong `Rc<Task>`
        // (`task`, and `s.running`) for the entire time this task executes, until `sched.switch`
        // returns to it; this switch is what returns control there, so the allocation (and the
        // `Fiber` inside it) is live for this call. Dropping our own clone above only decrements
        // a count that those two references keep above zero. Nothing else holds a `&mut` to the Fiber.
        let fiber = unsafe { &*fiber };
        // SAFETY: every local of this frame has been dropped or moved (`body` consumed, `task`
        // dropped); the frames below (`extern "C"` trampoline) own nothing; nothing references
        // this stack, and the scheduler never resumes a finished task.
        unsafe { fiber.mark_finished() };
        let _ = fiber.switch(&s.sched);
    });
    // The scheduler never resumes a finished task; reaching here is a bug.
    std::process::abort();
}
