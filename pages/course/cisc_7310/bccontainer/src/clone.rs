//! The only module allowed to use `unsafe`.

use nix::{errno::Errno, unistd::Pid};

use crate::cli::Run;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("clone: the process has more than one thread")]
    Threads,
    #[error("clone: {0}")]
    Clone(#[source] Errno),
}

pub fn spawn(_run: &Run) -> Result<Pid, Error> {
    todo!()
}
