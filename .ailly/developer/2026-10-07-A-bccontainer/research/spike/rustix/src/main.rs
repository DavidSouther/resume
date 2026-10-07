#![deny(unsafe_code)]
use std::{ffi::CString, os::unix::process::CommandExt, path::Path, process::{Command, ExitCode}};

use rustix::{
    io::Errno,
    mount::{MountFlags, MountPropagationFlags, mount, mount_change, mount_bind_recursive},
    process::{Pid, WaitOptions, chdir, chroot, waitpid},
    system::sethostname,
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
    Exec(String, #[source] std::io::Error),
    #[error("wait: {0}")]
    Wait(#[source] Errno),
}

#[allow(unsafe_code)]
mod sys {
    use rustix::io::Errno;
    use std::ffi::{c_int, c_void};
    type Cb = Box<dyn FnOnce() -> c_int>;
    extern "C" fn tramp(arg: *mut c_void) -> c_int {
        // SAFETY: arg is the Box<Cb> leaked in `clone`; consumed once in the child.
        let f: Box<Cb> = unsafe { Box::from_raw(arg.cast()) };
        f()
    }
    pub fn clone(f: Cb, flags: c_int) -> Result<i32, Errno> {
        let mut stack = vec![0u8; 1 << 20];
        let top = (stack.as_mut_ptr() as usize + stack.len()) & !15;
        let arg = Box::into_raw(Box::new(f));
        // SAFETY: stack top is 16-aligned and valid; no CLONE_VM so the child owns a copy of memory.
        let r = unsafe { libc::clone(tramp, top as *mut c_void, flags | libc::SIGCHLD, arg.cast()) };
        if r < 0 { Err(Errno::from_raw_os_error(std::io::Error::last_os_error().raw_os_error().unwrap_or(0))) } else { Ok(r) }
    }
}

fn child(rootfs: &Path, host: &str, argv: &[String]) -> Result<std::convert::Infallible, Error> {
    mount_change("/", MountPropagationFlags::REC | MountPropagationFlags::PRIVATE)
        .map_err(|source| Error::Mount { target: "/", source })?;
    sethostname(host.as_bytes()).map_err(Error::Hostname)?;
    mount_bind_recursive(rootfs, rootfs).map_err(|source| Error::Mount { target: "rootfs", source })?;
    mount("proc", rootfs.join("proc"), "proc", MountFlags::NOSUID | MountFlags::NOEXEC | MountFlags::NODEV, None)
        .map_err(|source| Error::Mount { target: "proc", source })?;
    chdir(rootfs).map_err(Error::Chroot)?;
    chroot(".").map_err(Error::Chroot)?;
    chdir("/").map_err(Error::Chroot)?;
    let e = Command::new(&argv[0]).args(&argv[1..]).exec();
    Err(Error::Exec(argv[0].clone(), e))
}

fn run(rootfs: &Path, host: &str, argv: &[String]) -> Result<i32, Error> {
    let (r, h, a) = (rootfs.to_owned(), host.to_owned(), argv.to_vec());
    let cb = Box::new(move || match child(&r, &h, &a) {
        Ok(never) => match never {},
        Err(e) => { eprintln!("bcdocker: {e}"); 1 }
    });
    let flags = libc::CLONE_NEWPID | libc::CLONE_NEWNS | libc::CLONE_NEWUTS | libc::CLONE_NEWIPC;
    let pid = sys::clone(cb, flags).map_err(Error::Clone)?;
    let pid = Pid::from_raw(pid).expect("pid");
    let (_, st) = waitpid(Some(pid), WaitOptions::empty()).map_err(Error::Wait)?.expect("child");
    Ok(st.exit_status().map(|c| c as i32).or(st.terminating_signal().map(|s| 128 + s as i32)).unwrap_or(1))
}

fn main() -> ExitCode {
    let a: Vec<String> = std::env::args().collect();
    let _ = CString::new("");
    match run(Path::new(&a[1]), &a[2], &a[3..]) {
        Ok(c) => ExitCode::from(c as u8),
        Err(e) => { eprintln!("bcdocker: {e}"); ExitCode::FAILURE }
    }
}
