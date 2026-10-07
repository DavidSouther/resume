#![deny(unsafe_code)]
use std::{convert::Infallible, ffi::CString, path::Path, process::ExitCode};

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
#[error("errno {0}")]
pub struct Errno(i32);

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
    use super::Errno;
    use std::{ffi::{CStr, CString, c_int, c_void}, ptr};

    fn check(r: c_int) -> Result<c_int, Errno> {
        if r < 0 { Err(Errno(std::io::Error::last_os_error().raw_os_error().unwrap_or(0))) } else { Ok(r) }
    }
    type Cb = Box<dyn FnOnce() -> c_int>;
    extern "C" fn tramp(arg: *mut c_void) -> c_int {
        // SAFETY: arg is the Box<Cb> leaked in `clone` below; consumed once in the child.
        let f: Box<Cb> = unsafe { Box::from_raw(arg.cast()) };
        f()
    }
    pub fn clone(f: Cb, flags: c_int) -> Result<i32, Errno> {
        let mut stack = vec![0u8; 1 << 20];
        let top = (stack.as_mut_ptr() as usize + stack.len()) & !15;
        let arg = Box::into_raw(Box::new(f));
        // SAFETY: stack top is 16-aligned and valid; no CLONE_VM so the child owns a copy of memory.
        check(unsafe { libc::clone(tramp, top as *mut c_void, flags | libc::SIGCHLD, arg.cast()) })
    }
    pub fn mount(src: Option<&CStr>, target: &CStr, fs: Option<&CStr>, flags: u64) -> Result<(), Errno> {
        let p = |c: Option<&CStr>| c.map_or(ptr::null(), CStr::as_ptr);
        // SAFETY: all pointers are valid NUL-terminated strings or null.
        check(unsafe { libc::mount(p(src), target.as_ptr(), p(fs), flags, ptr::null()) }).map(drop)
    }
    pub fn sethostname(name: &str) -> Result<(), Errno> {
        // SAFETY: pointer and length describe `name`.
        check(unsafe { libc::sethostname(name.as_ptr().cast(), name.len()) }).map(drop)
    }
    pub fn chroot(p: &CStr) -> Result<(), Errno> {
        // SAFETY: valid C string.
        check(unsafe { libc::chroot(p.as_ptr()) }).map(drop)
    }
    pub fn chdir(p: &CStr) -> Result<(), Errno> {
        // SAFETY: valid C string.
        check(unsafe { libc::chdir(p.as_ptr()) }).map(drop)
    }
    pub fn execv(path: &CStr, argv: &[CString]) -> Errno {
        let mut v: Vec<*const libc::c_char> = argv.iter().map(|a| a.as_ptr()).collect();
        v.push(ptr::null());
        // SAFETY: v is a NULL-terminated array of valid C strings.
        unsafe { libc::execv(path.as_ptr(), v.as_ptr()) };
        Errno(std::io::Error::last_os_error().raw_os_error().unwrap_or(0))
    }
    pub fn waitpid(pid: i32) -> Result<c_int, Errno> {
        let mut st = 0;
        // SAFETY: st is a valid out pointer.
        check(unsafe { libc::waitpid(pid, &mut st, 0) })?;
        Ok(st)
    }
}

fn c(s: &str) -> CString { CString::new(s).unwrap() }

fn child(rootfs: &Path, host: &str, argv: &[String]) -> Result<Infallible, Error> {
    let rf = CString::new(rootfs.as_os_str().as_encoded_bytes())?;
    let proc = CString::new(rootfs.join("proc").as_os_str().as_encoded_bytes())?;
    let (ms_rec, ms_private, ms_bind) = (libc::MS_REC, libc::MS_PRIVATE, libc::MS_BIND);
    sys::mount(None, &c("/"), None, ms_rec | ms_private).map_err(|source| Error::Mount { target: "/", source })?;
    sys::sethostname(host).map_err(Error::Hostname)?;
    sys::mount(Some(&rf), &rf, None, ms_bind | ms_rec).map_err(|source| Error::Mount { target: "rootfs", source })?;
    sys::mount(Some(&c("proc")), &proc, Some(&c("proc")), libc::MS_NOSUID | libc::MS_NOEXEC | libc::MS_NODEV)
        .map_err(|source| Error::Mount { target: "proc", source })?;
    sys::chdir(&rf).map_err(Error::Chroot)?;
    sys::chroot(&c(".")).map_err(Error::Chroot)?;
    sys::chdir(&c("/")).map_err(Error::Chroot)?;
    let args = argv.iter().map(|a| CString::new(a.as_str())).collect::<Result<Vec<_>, _>>()?;
    Err(Error::Exec(argv[0].clone(), sys::execv(&args[0], &args)))
}

fn run(rootfs: &Path, host: &str, argv: &[String]) -> Result<i32, Error> {
    let (r, h, a) = (rootfs.to_owned(), host.to_owned(), argv.to_vec());
    let cb = Box::new(move || match child(&r, &h, &a) {
        Ok(never) => match never {},
        Err(e) => { eprintln!("bcdocker: {e}"); 1 }
    });
    let flags = libc::CLONE_NEWPID | libc::CLONE_NEWNS | libc::CLONE_NEWUTS | libc::CLONE_NEWIPC;
    let pid = sys::clone(cb, flags).map_err(Error::Clone)?;
    let st = sys::waitpid(pid).map_err(Error::Wait)?;
    Ok(if libc::WIFEXITED(st) { libc::WEXITSTATUS(st) } else { 128 + libc::WTERMSIG(st) })
}

fn main() -> ExitCode {
    let a: Vec<String> = std::env::args().collect();
    match run(Path::new(&a[1]), &a[2], &a[3..]) {
        Ok(c) => ExitCode::from(c as u8),
        Err(e) => { eprintln!("bcdocker: {e}"); ExitCode::FAILURE }
    }
}
