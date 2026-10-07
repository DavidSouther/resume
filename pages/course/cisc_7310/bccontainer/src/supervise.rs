//! PID 1 of the container: its whole life, from the parent-death signal to exit.

use std::{io, process::Command};

use nix::{errno::Errno, sys::wait::waitpid, unistd::Pid};

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

fn supervise(run: &Run) -> Result<Status, Error> {
    sandbox::enter(&run.container)?;
    let child = Command::new(&run.app)
        .args(&run.args)
        .spawn()
        .map_err(|source| Error::Exec { app: run.app.clone(), source })?;
    let app = Pid::from_raw(child.id() as i32);
    loop {
        if let Some(status) = Status::from_wait(waitpid(app, None).map_err(Error::Wait)?) {
            return Ok(status);
        }
    }
}
