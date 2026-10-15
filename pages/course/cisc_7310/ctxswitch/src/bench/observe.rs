//! Kernel view observers. A separate observer *process* dumps `/proc/<pid>/task/<tid>/...` of the
//! benchmark while it runs, so the observer is never one of the benchmark's own tasks.

use std::fs;
use std::sync::OnceLock;
use std::time::Duration;

static MIN_RUNTIME: OnceLock<Duration> = OnceLock::new();

/// How long a measured loop must keep running (zero outside snapshot mode).
pub fn min_runtime() -> Duration {
    MIN_RUNTIME.get().copied().unwrap_or(Duration::ZERO)
}

pub fn require_runtime(d: Duration) {
    let _ = MIN_RUNTIME.set(d);
}

const FILES: [&str; 5] = ["stat", "status", "syscall", "wchan", "stack"];

/// Print each readable file for every task of `pid` as a `== path ==` block. Missing or denied
/// files print a one line note.
pub fn snapshot(pid: u32, delay: Duration) {
    std::thread::sleep(delay);
    let dir = format!("/proc/{pid}/task");
    let Ok(tasks) = fs::read_dir(&dir) else {
        println!("== {dir} ==\n(unreadable)");
        return;
    };
    let mut tids: Vec<String> = tasks.flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect();
    tids.sort();
    for tid in tids {
        for f in FILES {
            let path = format!("/proc/{pid}/task/{tid}/{f}");
            println!("== {path} ==");
            match fs::read_to_string(&path) {
                Ok(text) => print!("{}", if text.ends_with('\n') { text } else { text + "\n" }),
                Err(e) => println!("(error: {e})"),
            }
        }
    }
}
