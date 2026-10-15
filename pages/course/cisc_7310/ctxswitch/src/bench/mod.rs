//! The switching cost benchmark: five mechanisms and two baselines, one CSV row per
//! (mechanism, working set). Every mechanism performs exactly `switches` task-to-task handoffs per
//! repetition, and every side touches its private working set before each handoff it makes.

pub mod observe;
pub mod user;

use std::io::{self, Read, Write};
use std::os::fd::AsFd;
use std::os::unix::net::UnixStream;
use std::process::{Command, Stdio};
use std::time::Instant;

use nix::sched::{sched_getaffinity, sched_setaffinity, CpuSet};
use nix::sys::resource::{getrusage, Usage, UsageWho};
use nix::sys::signal::{sigprocmask, SigSet, SigmaskHow};
use nix::unistd::Pid;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("io: {0}")]
    Io(#[from] io::Error),
    #[error("system call: {0}")]
    Nix(#[from] nix::Error),
    #[error("ucontext: {0}")]
    Uctx(#[from] crate::uctx::Error),
    #[error("regswitch: {0}")]
    Reg(#[from] crate::regswitch::Error),
    #[error("green: {0}")]
    Green(#[from] crate::green::Error),
    #[error("{0}")]
    Usage(String),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mechanism {
    Thread,
    Process,
    Ucontext,
    Regswitch,
    Green,
    BaselineSocket,
    BaselineSigprocmask,
}

impl Mechanism {
    pub const ALL: [Mechanism; 5] =
        [Mechanism::Thread, Mechanism::Process, Mechanism::Ucontext, Mechanism::Regswitch, Mechanism::Green];

    /// Everything `switchbench` runs by default (baselines only at working set 0).
    pub const DEFAULT: [Mechanism; 7] = [
        Mechanism::Thread,
        Mechanism::Process,
        Mechanism::Ucontext,
        Mechanism::Regswitch,
        Mechanism::Green,
        Mechanism::BaselineSocket,
        Mechanism::BaselineSigprocmask,
    ];

    pub fn is_baseline(self) -> bool {
        matches!(self, Mechanism::BaselineSocket | Mechanism::BaselineSigprocmask)
    }

    pub fn name(self) -> &'static str {
        match self {
            Mechanism::Thread => "thread",
            Mechanism::Process => "process",
            Mechanism::Ucontext => "ucontext",
            Mechanism::Regswitch => "regswitch",
            Mechanism::Green => "green",
            Mechanism::BaselineSocket => "baseline-socket",
            Mechanism::BaselineSigprocmask => "baseline-sigprocmask",
        }
    }

    pub fn parse(s: &str) -> Result<Self, Error> {
        Mechanism::DEFAULT
            .into_iter()
            .find(|m| m.name() == s)
            .ok_or_else(|| Error::Usage(format!("unknown mechanism '{s}'")))
    }
}

/// A private buffer touched one byte per cache line, standing in for a thread's working set.
pub struct WorkingSet(Vec<u8>);

impl WorkingSet {
    pub fn new(bytes: usize) -> Self {
        WorkingSet(vec![1u8; bytes])
    }

    #[inline(always)]
    pub fn touch(&mut self) {
        for i in (0..self.0.len()).step_by(64) {
            self.0[i] = self.0[i].wrapping_add(1);
        }
        std::hint::black_box(&mut self.0);
    }
}

/// Options shared by all mechanisms.
#[derive(Clone, Copy, Debug)]
pub struct Plan {
    /// Task-to-task handoffs per repetition (even).
    pub switches: u64,
    pub reps: u32,
    pub working_set: usize,
    /// Skip the unrecorded warmup repetition (so `strace -c` sees only the measured loop).
    pub no_warmup: bool,
}

#[derive(Clone, Debug)]
pub struct Row {
    pub mechanism: &'static str,
    pub working_set_bytes: usize,
    pub switches_per_rep: u64,
    pub reps: u32,
    pub ns_per_switch: f64,
    pub nvcsw: u64,
    pub nivcsw: u64,
}

impl Row {
    pub const HEADER: &'static str = "mechanism,working_set_bytes,switches_per_rep,reps,ns_per_switch,nvcsw,nivcsw";

    pub fn csv(&self) -> String {
        format!(
            "{},{},{},{},{:.1},{},{}",
            self.mechanism, self.working_set_bytes, self.switches_per_rep, self.reps, self.ns_per_switch, self.nvcsw, self.nivcsw
        )
    }
}

/// Pin the calling thread to the first CPU its affinity mask allows, so that two tasks share a CPU.
pub fn pin_to_first_cpu() -> Result<(), Error> {
    let allowed = sched_getaffinity(Pid::from_raw(0))?;
    for cpu in 0..CpuSet::count() {
        if allowed.is_set(cpu)? {
            let mut one = CpuSet::new();
            one.set(cpu)?;
            sched_setaffinity(Pid::from_raw(0), &one)?;
            return Ok(());
        }
    }
    Err(Error::Usage("affinity mask is empty".into()))
}

fn ctx_switches(u: &Usage) -> (i64, i64) {
    (u.voluntary_context_switches() as i64, u.involuntary_context_switches() as i64)
}

/// Kernel context switch counters of this process (all its threads), plus waited-for children.
pub struct Counters(i64, i64);

impl Counters {
    pub fn now() -> Result<Self, Error> {
        let s = ctx_switches(&getrusage(UsageWho::RUSAGE_SELF)?);
        let c = ctx_switches(&getrusage(UsageWho::RUSAGE_CHILDREN)?);
        Ok(Counters(s.0 + c.0, s.1 + c.1))
    }

    pub fn since(&self, before: &Counters) -> (u64, u64) {
        ((self.0 - before.0).max(0) as u64, (self.1 - before.1).max(0) as u64)
    }
}

/// Run `rep` for `warmup + reps` repetitions and return the median ns per switch of the measured ones.
/// `min_runtime` keeps a snapshot run alive long enough for the observer process to look.
pub fn measure(plan: &Plan, mut rep: impl FnMut() -> Result<(), Error>) -> Result<f64, Error> {
    if !plan.no_warmup {
        rep()?;
    }
    let started = Instant::now();
    let mut samples = Vec::with_capacity(plan.reps as usize);
    let mut n = 0;
    while n < plan.reps || started.elapsed() < observe::min_runtime() {
        let t = Instant::now();
        rep()?;
        samples.push(t.elapsed().as_nanos() as f64 / plan.switches as f64);
        n += 1;
    }
    samples.sort_by(f64::total_cmp);
    Ok(samples[samples.len() / 2])
}

pub fn run(m: Mechanism, plan: Plan) -> Result<Row, Error> {
    if plan.switches == 0 || plan.switches % 2 != 0 {
        return Err(Error::Usage("--switches must be a positive even number".into()));
    }
    let before = Counters::now()?;
    let ns = match m {
        Mechanism::Thread => thread(&plan)?,
        Mechanism::Process => process(&plan)?,
        Mechanism::Ucontext => user::ucontext(&plan)?,
        Mechanism::Regswitch => user::regswitch(&plan)?,
        Mechanism::Green => user::green(&plan)?,
        Mechanism::BaselineSocket => baseline_socket(&plan)?,
        Mechanism::BaselineSigprocmask => baseline_sigprocmask(&plan)?,
    };
    let (nvcsw, nivcsw) = Counters::now()?.since(&before);
    Ok(Row {
        mechanism: m.name(),
        working_set_bytes: plan.working_set,
        switches_per_rep: plan.switches,
        reps: plan.reps,
        ns_per_switch: ns,
        nvcsw,
        nivcsw,
    })
}

/// Two threads of one process, one CPU, one byte token over a socket pair. Each round trip is two handoffs.
fn thread(plan: &Plan) -> Result<f64, Error> {
    let (a, b) = UnixStream::pair()?;
    let ws = plan.working_set;
    let peer = std::thread::spawn(move || -> Result<(), Error> {
        pin_to_first_cpu()?;
        echo(&b, WorkingSet::new(ws))
    });
    pin_to_first_cpu()?;
    let result = ping(plan, &a);
    drop(a);
    peer.join().map_err(|_| Error::Usage("peer thread panicked".into()))??;
    result
}

/// Same, with the peer in a separate process (re-executed `switchbench --peer`, socket on its stdin).
fn process(plan: &Plan) -> Result<f64, Error> {
    let (a, b) = UnixStream::pair()?;
    let mut child = Command::new(std::env::current_exe()?)
        .arg("--peer")
        .arg("--peer-ws")
        .arg(plan.working_set.to_string())
        .stdin(Stdio::from(std::os::fd::OwnedFd::from(b)))
        .spawn()?;
    pin_to_first_cpu()?;
    let result = ping(plan, &a);
    drop(a);
    child.wait()?;
    result
}

/// The `--peer` side of [`process`].
pub fn peer_main(working_set: usize) -> Result<(), Error> {
    pin_to_first_cpu()?;
    let sock = UnixStream::from(std::io::stdin().as_fd().try_clone_to_owned()?);
    echo(&sock, WorkingSet::new(working_set))
}

fn echo(sock: &UnixStream, mut ws: WorkingSet) -> Result<(), Error> {
    let mut byte = [0u8; 1];
    let (mut r, mut w) = (sock, sock);
    while r.read_exact(&mut byte).is_ok() {
        ws.touch();
        w.write_all(&byte)?;
    }
    Ok(())
}

fn ping(plan: &Plan, sock: &UnixStream) -> Result<f64, Error> {
    let mut ws = WorkingSet::new(plan.working_set);
    let mut byte = [1u8; 1];
    let (mut r, mut w) = (sock, sock);
    measure(plan, || {
        for _ in 0..plan.switches / 2 {
            ws.touch();
            w.write_all(&byte)?;
            r.read_exact(&mut byte)?;
        }
        Ok(())
    })
}

/// One thread writes and reads its own socket pair: the same two system calls per handoff as
/// `thread`, with no task switch.
fn baseline_socket(plan: &Plan) -> Result<f64, Error> {
    let (a, b) = UnixStream::pair()?;
    pin_to_first_cpu()?;
    let mut byte = [1u8; 1];
    let (mut w, mut r) = (&a, &b);
    measure(plan, || {
        for _ in 0..plan.switches {
            w.write_all(&byte)?;
            r.read_exact(&mut byte)?;
        }
        Ok(())
    })
}

/// The `rt_sigprocmask` calls glibc's `swapcontext` makes per switch, on their own. `strace -c`
/// in the aarch64 Debian image shows two per `swapcontext` (save the mask, then restore the other
/// one); x86_64 glibc makes one.
#[cfg(target_arch = "aarch64")]
const SIGPROCMASK_CALLS_PER_SWAPCONTEXT: u32 = 2;
#[cfg(not(target_arch = "aarch64"))]
const SIGPROCMASK_CALLS_PER_SWAPCONTEXT: u32 = 1;

fn baseline_sigprocmask(plan: &Plan) -> Result<f64, Error> {
    pin_to_first_cpu()?;
    let none = SigSet::empty();
    measure(plan, || {
        for _ in 0..plan.switches {
            for _ in 0..SIGPROCMASK_CALLS_PER_SWAPCONTEXT {
                sigprocmask(SigmaskHow::SIG_BLOCK, Some(&none), None)?;
            }
        }
        Ok(())
    })
}

pub fn parse_sizes(s: &str) -> Result<Vec<usize>, Error> {
    s.split(',')
        .map(|p| p.trim().parse::<usize>().map_err(|e| Error::Usage(format!("bad working set '{p}': {e}"))))
        .collect()
}
