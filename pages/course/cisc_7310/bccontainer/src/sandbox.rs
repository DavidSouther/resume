//! Inside the new namespaces: private mounts, hostname, `/proc`, `/dev`, and chroot.

use nix::errno::Errno;

use crate::container::Container;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("mount {target}: {source}")]
    Mount { target: &'static str, source: Errno },
    #[error("sethostname: {0}")]
    Hostname(#[source] Errno),
    #[error("chroot: {0}")]
    Chroot(#[source] Errno),
    #[error("mknod /dev/{device}: {source}")]
    Mknod { device: &'static str, source: Errno },
}

pub fn enter(_container: &Container) -> Result<(), Error> {
    todo!()
}
