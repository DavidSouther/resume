//! Kernel versus user-level task switching cost. See the crate README.
//!
//! switchbench [--mechanisms a,b] [--switches N] [--reps N] [--working-sets 0,32768,262144]
//!             [--strace-friendly] [--proc-snapshot]
use std::process::{Command, ExitCode};
use std::time::Duration;

use ctxswitch::bench::{self, observe, Error, Mechanism, Plan, Row};

struct Args {
    mechanisms: Vec<Mechanism>,
    switches: u64,
    reps: u32,
    working_sets: Vec<usize>,
    strace_friendly: bool,
    proc_snapshot: bool,
}

enum Mode {
    Bench(Args),
    Peer { working_set: usize },
    Observe { pid: u32 },
}

fn parse() -> Result<Mode, Error> {
    let mut a = Args {
        mechanisms: Mechanism::DEFAULT.to_vec(),
        switches: 200_000,
        reps: 5,
        working_sets: vec![0, 32 * 1024, 256 * 1024],
        strace_friendly: false,
        proc_snapshot: false,
    };
    let (mut peer, mut peer_ws, mut observe_pid) = (false, 0usize, None);
    let mut it = std::env::args().skip(1);
    let value = |it: &mut dyn Iterator<Item = String>, flag: &str| {
        it.next().ok_or_else(|| Error::Usage(format!("{flag} needs a value")))
    };
    while let Some(flag) = it.next() {
        match flag.as_str() {
            "--mechanisms" => {
                a.mechanisms = value(&mut it, &flag)?.split(',').map(Mechanism::parse).collect::<Result<_, _>>()?
            }
            "--switches" => a.switches = value(&mut it, &flag)?.parse().map_err(|e| Error::Usage(format!("--switches: {e}")))?,
            "--reps" => a.reps = value(&mut it, &flag)?.parse().map_err(|e| Error::Usage(format!("--reps: {e}")))?,
            "--working-sets" => a.working_sets = bench::parse_sizes(&value(&mut it, &flag)?)?,
            "--strace-friendly" => a.strace_friendly = true,
            "--proc-snapshot" => a.proc_snapshot = true,
            "--peer" => peer = true,
            "--peer-ws" => peer_ws = value(&mut it, &flag)?.parse().map_err(|e| Error::Usage(format!("--peer-ws: {e}")))?,
            "--observe" => observe_pid = Some(value(&mut it, &flag)?.parse().map_err(|e| Error::Usage(format!("--observe: {e}")))?),
            other => return Err(Error::Usage(format!("unknown option '{other}'"))),
        }
    }
    if a.reps == 0 {
        return Err(Error::Usage("--reps must be positive".into()));
    }
    Ok(match (peer, observe_pid) {
        (true, _) => Mode::Peer { working_set: peer_ws },
        (_, Some(pid)) => Mode::Observe { pid },
        _ => Mode::Bench(a),
    })
}

fn main() -> ExitCode {
    match real_main() {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("switchbench: {e}");
            ExitCode::FAILURE
        }
    }
}

fn real_main() -> Result<(), Error> {
    match parse()? {
        Mode::Peer { working_set } => bench::peer_main(working_set),
        Mode::Observe { pid } => {
            observe::snapshot(pid, Duration::from_millis(500));
            Ok(())
        }
        Mode::Bench(a) => {
            let mut observer = None;
            if a.proc_snapshot {
                observe::require_runtime(Duration::from_millis(1500));
                observer = Some(Command::new(std::env::current_exe()?).args(["--observe", &std::process::id().to_string()]).spawn()?);
            }
            println!("{}", Row::HEADER);
            for &ws in &a.working_sets {
                for &m in &a.mechanisms {
                    if m.is_baseline() && ws != 0 {
                        continue;
                    }
                    let plan = Plan { switches: a.switches, reps: a.reps, working_set: ws, no_warmup: a.strace_friendly };
                    println!("{}", bench::run(m, plan)?.csv());
                }
            }
            if let Some(mut o) = observer {
                o.wait()?;
            }
            Ok(())
        }
    }
}
