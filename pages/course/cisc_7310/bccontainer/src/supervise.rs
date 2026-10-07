//! PID 1 of the container: its whole life, from the parent-death signal to exit.

use std::{io, os::fd::RawFd, process::Command};

use nix::{
    errno::Errno,
    sys::{prctl::set_pdeathsig, signal::Signal, wait::waitpid},
    unistd::{close, Pid},
};

use crate::{cli::Run, sandbox, status::Status};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("prctl: {0}")]
    Pdeathsig(#[source] Errno),
    #[error(transparent)]
    Sandbox(#[from] sandbox::Error),
    #[error("close fds: {0}")]
    Fds(#[source] io::Error),
    #[error("exec {app}: {source}")]
    Exec { app: String, source: io::Error },
    #[error("wait: {0}")]
    Wait(#[source] Errno),
}

/// Replaces the host's `PATH`, whose directories need not exist in the rootfs; this is Debian's
/// default. Other variables pass through.
const DEBIAN_PATH: &str = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";

/// Runs the container's PID 1 and returns its exit status. A failure is printed here,
/// inside the container, and gives status 1.
pub fn container_main(run: &Run) -> i32 {
    match supervise(run) {
        Ok(status) => status.code().into(),
        Err(e) => {
            eprintln!("bcdocker: {e}");
            1
        }
    }
}

/// PID 1's work: enter the sandbox, start the application, and reap until it exits.
fn supervise(run: &Run) -> Result<Status, Error> {
    // The parent-death signal fires when the thread that created PID 1 exits. By I1 in
    // `clone.rs` that is the host process's only thread, so it fires when the host-side
    // `bcdocker` dies. A short window remains if the parent dies before this call; the usual
    // check of the parent pid cannot close it, because the parent pid reads 0 inside a new
    // PID namespace.
    set_pdeathsig(Signal::SIGKILL).map_err(Error::Pdeathsig)?;
    sandbox::enter(&run.container)?;
    // After enter: lists the container's own /proc and closes anything setup left open.
    close_extra_fds().map_err(Error::Fds)?;
    let child = Command::new(&run.app)
        .args(run.args.as_slice())
        .env("PATH", DEBIAN_PATH)
        .spawn()
        .map_err(|source| Error::Exec { app: run.app.clone(), source })?;
    let app = Pid::from_raw(child.id() as i32);
    // Orphans are reparented to PID 1: wait for any child, and finish with the application's.
    loop {
        let wait = waitpid(None, None).map_err(Error::Wait)?;
        if wait.pid() == Some(app) {
            if let Some(status) = Status::from_wait(wait) {
                return Ok(status);
            }
        }
    }
}

/// The descriptors above `min` that are open now. The result can include the number of the
/// directory handle used to list them, which is closed again before this returns.
fn open_fds_above(min: RawFd) -> io::Result<Vec<RawFd>> {
    let mut fds = Vec::new();
    for entry in std::fs::read_dir("/proc/self/fd")? {
        let name = entry?.file_name();
        if let Some(fd) = name.to_str().and_then(|s| s.parse::<RawFd>().ok()) {
            if fd > min {
                fds.push(fd);
            }
        }
    }
    Ok(fds)
}

/// Closes every descriptor above 2, so the application inherits only stdin, stdout and
/// stderr. A host directory descriptor left open would let `fchdir` leave the chroot.
///
/// Call only in the cloned PID 1, after `sandbox::enter`. There, no live value owns a
/// descriptor above 2: the parent's frames were copied by `clone::spawn` but are never resumed
/// or dropped here, no static in this crate, std, nix or glibc holds one, and the `ReadDir`
/// used to list them is dropped in `open_fds_above`; its number then gives `EBADF`, which is
/// ignored. The parent's descriptors are unaffected because `CLONE_FLAGS` excludes
/// `CLONE_FILES`. In the host process this would close descriptors owned by live values.
fn close_extra_fds() -> io::Result<()> {
    for fd in open_fds_above(2)? {
        let _ = close(fd);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::fd::AsRawFd;

    #[test]
    fn an_open_file_is_listed_and_the_standard_descriptors_are_not() {
        let file = std::fs::File::open("/dev/null").unwrap();

        let fds = open_fds_above(2).unwrap();

        assert!(fds.contains(&file.as_raw_fd()));
        assert!(fds.iter().all(|fd| *fd > 2));
    }
}
