//! The top-level error. Every leaf message starts with its step, so `main`'s line
//! reads `bcdocker: <step>: <reason>`.

use crate::cli;
use crate::container;
#[cfg(target_os = "linux")]
use crate::launch;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[cfg(not(target_os = "linux"))]
    #[error("platform: bcdocker needs Linux namespaces")]
    NotLinux,
    #[cfg(target_os = "linux")]
    #[error("privilege: bcdocker needs root; under Docker, run with --privileged")]
    NotRoot,
    #[error(transparent)]
    Cli(#[from] cli::Error),
    #[error(transparent)]
    Container(#[from] container::Error),
    #[cfg(target_os = "linux")]
    #[error(transparent)]
    Launch(#[from] launch::Error),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "linux")]
    #[test]
    fn not_root_displays_with_a_step_and_the_privileged_hint() {
        assert_eq!(
            Error::NotRoot.to_string(),
            "privilege: bcdocker needs root; under Docker, run with --privileged"
        );
    }

    #[test]
    fn a_usage_error_passes_through_without_a_second_prefix() {
        let e = Error::from(cli::Error::Usage);

        assert_eq!(e.to_string(), "usage: bcdocker run [--stack-size <size>] <container> <app> [args...]");
    }
}
