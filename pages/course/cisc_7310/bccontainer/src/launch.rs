//! The host side: clone the container, then wait for it.

use nix::errno::Errno;

use crate::{clone, cli::Run, status::Status};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Clone(#[from] clone::Error),
    #[error("wait: {0}")]
    Wait(#[source] Errno),
}

pub fn launch(_run: &Run) -> Result<Status, Error> {
    todo!()
}
