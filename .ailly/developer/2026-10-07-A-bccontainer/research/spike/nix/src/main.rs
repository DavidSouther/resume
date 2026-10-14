#![deny(unsafe_code)]
use std::{convert::Infallible, ffi::CString, path::Path, process::ExitCode};

use nix::{
    errno::Errno,
    mount::{MsFlags, mount},
    sched::CloneFlags,
    sys::wait::{WaitStatus, waitpid},
    unistd::{chdir, chroot, execv, sethostname},
};

#[derive(Debug, thiserror::Error)]
enum Error {
    #[error("clone: {0}")]
    Clone(#[source] Errno),
    #[error("mount {target}: {source}")]
    Mount { target: &'static str, #[source] source: Errno },
    #[error("sethostname: {0}")]
    Hostname(#[source] Errno),
    #[error("chroot: {0}")]
    Chroot(#[source] Errno),
    #[error("exec {0:?}: {1}")]
    Exec(String, #[source] Errno),
    #[error("wait: {0}")]
    Wait(#[source] Errno),
    #[error("argument contains NUL: {0}")]
    Nul(#[from] std::ffi::NulError),
}

#[allow(unsafe_code)]
mod sys {
    use nix::{errno::Errno, sched::{CloneFlags, clone}, unistd::Pid};
    pub fn spawn(cb: Box<dyn FnMut() -> isize>, flags: CloneFlags) -> Result<Pid, Errno> {
        let mut stack = vec![0u8; 1 << 20];
        // SAFETY: child never returns into this frame; it execs or exits.
        // Stack is owned for the call; no CLONE_VM so the child has its own copy.
        unsafe { clone(cb, &mut stack, flags, Some(nix::libc::SIGCHLD)) }
    }
}

fn child(rootfs: &Path, host: &str, argv: &[String]) -> Result<Infallible, Error> {
    let none = None::<&str>;
    mount(none, "/", none, MsFlags::MS_REC | MsFlags::MS_PRIVATE, none)
        .map_err(|source| Error::Mount { target: "/", source })?;
    sethostname(host).map_err(Error::Hostname)?;
    mount(Some(rootfs), rootfs, none, MsFlags::MS_BIND | MsFlags::MS_REC, none)
        .map_err(|source| Error::Mount { target: "rootfs", source })?;
    mount(
        Some("proc"),
        &rootfs.join("proc"),
        Some("proc"),
        MsFlags::MS_NOSUID | MsFlags::MS_NOEXEC | MsFlags::MS_NODEV,
        none,
    )
    .map_err(|source| Error::Mount { target: "proc", source })?;
    chdir(rootfs).map_err(Error::Chroot)?;
    chroot(".").map_err(Error::Chroot)?;
    chdir("/").map_err(Error::Chroot)?;
    let args = argv.iter().map(|a| CString::new(a.as_str())).collect::<Result<Vec<_>, _>>()?;
    execv(&args[0], &args).map_err(|e| Error::Exec(argv[0].clone(), e))
}

fn run(rootfs: &Path, host: &str, argv: &[String]) -> Result<i32, Error> {
    let (r, h, a) = (rootfs.to_owned(), host.to_owned(), argv.to_vec());
    let cb = Box::new(move || match child(&r, &h, &a) {
        Ok(never) => match never {},
        Err(e) => {
            eprintln!("bcdocker: {e}");
            1
        }
    });
    let flags = CloneFlags::CLONE_NEWPID | CloneFlags::CLONE_NEWNS | CloneFlags::CLONE_NEWUTS | CloneFlags::CLONE_NEWIPC;
    let pid = sys::spawn(cb, flags).map_err(Error::Clone)?;
    match waitpid(pid, None).map_err(Error::Wait)? {
        WaitStatus::Exited(_, c) => Ok(c),
        WaitStatus::Signaled(_, s, _) => Ok(128 + s as i32),
        _ => Ok(1),
    }
}

fn main() -> ExitCode {
    let a: Vec<String> = std::env::args().collect();
    match run(Path::new(&a[1]), &a[2], &a[3..]) {
        Ok(c) => ExitCode::from(c as u8),
        Err(e) => {
            eprintln!("bcdocker: {e}");
            ExitCode::FAILURE
        }
    }
}
