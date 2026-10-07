#![deny(unsafe_code)]
//! bcdocker: run a program in a container made of new PID, mount, UTS, and IPC
//! namespaces and a chroot.

mod cli;
mod container;
mod error;
mod stack;
mod status;

#[cfg(target_os = "linux")]
#[allow(unsafe_code)]
mod clone;
#[cfg(target_os = "linux")]
mod launch;
#[cfg(target_os = "linux")]
mod sandbox;
#[cfg(target_os = "linux")]
mod supervise;

use std::process::ExitCode;

use error::Error;
use status::Status;

fn main() -> ExitCode {
    match run() {
        Ok(status) => ExitCode::from(status.code()),
        Err(e) => {
            eprintln!("bcdocker: {e}");
            ExitCode::FAILURE
        }
    }
}

/// Usage errors come first, on any platform and without root, so a typo never looks like a
/// privilege error.
fn run() -> Result<Status, Error> {
    let args = cli::parse(std::env::args())?;
    #[cfg(not(target_os = "linux"))]
    {
        let _ = args;
        Err(Error::NotLinux)
    }
    #[cfg(target_os = "linux")]
    {
        if !nix::unistd::geteuid().is_root() {
            return Err(Error::NotRoot);
        }
        let run = cli::Run::resolve(args, std::path::Path::new("."))?;
        Ok(launch::launch(&run)?)
    }
}
