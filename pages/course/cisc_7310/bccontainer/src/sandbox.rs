//! Inside the new namespaces: private mounts, hostname, `/proc`, `/dev`, and chroot.

use nix::{
    errno::Errno,
    mount::{mount, MsFlags},
    sys::stat::{makedev, mknod, umask, Mode, SFlag},
    unistd::{chdir, chroot, sethostname},
};

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

/// A character device created in the container's `/dev`.
pub struct DevNode {
    pub name: &'static str,
    pub major: u64,
    pub minor: u64,
}

/// The OCI runtime spec's default devices, less `/dev/console` and `/dev/ptmx`: there is no
/// pseudo-terminal, so `tty` reports "not a tty".
pub const DEV_NODES: [DevNode; 6] = [
    DevNode { name: "null", major: 1, minor: 3 },
    DevNode { name: "zero", major: 1, minor: 5 },
    DevNode { name: "full", major: 1, minor: 7 },
    DevNode { name: "random", major: 1, minor: 8 },
    DevNode { name: "urandom", major: 1, minor: 9 },
    DevNode { name: "tty", major: 5, minor: 0 },
];

/// Must run in a process with its own mount and UTS namespaces (see `clone::CLONE_FLAGS`);
/// elsewhere it changes the host. Every mount lives in the private mount namespace, so
/// nothing remains on the host. Leaves the rootfs directory on disk unchanged: `proc` and
/// `dev` are only mounted over, and the device nodes go into the tmpfs.
pub fn enter(container: &Container) -> Result<(), Error> {
    let none = None::<&str>;
    let root = container.rootfs();
    let (proc_dir, dev_dir) = (root.join("proc"), root.join("dev"));

    // Stop mount propagation, or everything below leaks to the host.
    mount(none, "/", none, MsFlags::MS_REC | MsFlags::MS_PRIVATE, none)
        .map_err(|source| Error::Mount { target: "/", source })?;
    sethostname(container.hostname().as_str()).map_err(Error::Hostname)?;
    // Bind the rootfs onto itself so the container's `/` is a mount point: otherwise its mount
    // table has no entry for `/`, and `findmnt /` or `df /` inside cannot describe it.
    mount(Some(root), root, none, MsFlags::MS_BIND | MsFlags::MS_REC, none)
        .map_err(|source| Error::Mount { target: "rootfs", source })?;
    mount(
        Some("proc"),
        &proc_dir,
        Some("proc"),
        MsFlags::MS_NOSUID | MsFlags::MS_NOEXEC | MsFlags::MS_NODEV,
        none,
    )
    .map_err(|source| Error::Mount { target: "/proc", source })?;
    mount(Some("tmpfs"), &dev_dir, Some("tmpfs"), MsFlags::MS_NOSUID, none)
        .map_err(|source| Error::Mount { target: "/dev", source })?;

    // mknod applies the umask; the nodes must be 0666. Restore it for the application.
    let old_umask = umask(Mode::empty());
    for device in &DEV_NODES {
        mknod(
            &dev_dir.join(device.name),
            SFlag::S_IFCHR,
            Mode::from_bits_truncate(0o666),
            makedev(device.major, device.minor),
        )
        .map_err(|source| Error::Mknod { device: device.name, source })?;
    }
    umask(old_umask);

    // chroot does not move the working directory: enter the root by path, make it the root, and
    // land on `/`, so no working directory is left outside it. This follows the self bind mount,
    // so the new root is that mount. chroot does not confine a root process; a nested chroot
    // climbs back out.
    chdir(root).map_err(Error::Chroot)?;
    chroot(".").map_err(Error::Chroot)?;
    chdir("/").map_err(Error::Chroot)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_dev_table_lists_the_six_oci_devices_with_their_numbers() {
        let table: Vec<_> = DEV_NODES.iter().map(|d| (d.name, d.major, d.minor)).collect();

        assert_eq!(
            table,
            [("null", 1, 3), ("zero", 1, 5), ("full", 1, 7), ("random", 1, 8), ("urandom", 1, 9), ("tty", 5, 0)]
        );
    }
}
