//! PID 1 of the container: its whole life, from the parent-death signal to exit.

use std::io;

use nix::errno::Errno;

use crate::{cli::Run, sandbox};

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

/// Runs the container's PID 1 and returns its exit status.
pub fn container_main(_run: &Run) -> i32 {
    todo!()
}
