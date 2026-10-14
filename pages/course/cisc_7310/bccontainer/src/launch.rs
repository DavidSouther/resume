//! The host side: clone the container, then wait for it.

use nix::{errno::Errno, sys::wait::waitpid};

use crate::{cli::Run, clone, status::Status};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Clone(#[from] clone::Error),
    #[error("wait: {0}")]
    Wait(#[source] Errno),
}

pub fn launch(run: &Run) -> Result<Status, Error> {
    let pid = clone::spawn(run)?;
    loop {
        if let Some(status) = Status::from_wait(waitpid(pid, None).map_err(Error::Wait)?) {
            return Ok(status);
        }
    }
}
