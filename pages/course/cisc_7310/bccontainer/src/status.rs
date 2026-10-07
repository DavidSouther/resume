//! What the host shell sees: the application's exit code, or 128 plus the signal.

use nix::sys::wait::WaitStatus;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Status(u8);

impl Status {
    /// `Exited` gives the code, `Signaled` gives 128 + the signal; other statuses are not final.
    pub fn from_wait(w: WaitStatus) -> Option<Status> {
        match w {
            WaitStatus::Exited(_, code) => Some(Status(code as u8)),
            WaitStatus::Signaled(_, signal, _) => Some(Status(128 + signal as i32 as u8)),
            _ => None,
        }
    }

    pub fn code(self) -> u8 {
        self.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use nix::{sys::signal::Signal, unistd::Pid};

    #[test]
    fn a_signal_maps_to_128_plus_the_signal_number() {
        let status = Status::from_wait(WaitStatus::Signaled(Pid::from_raw(2), Signal::SIGKILL, false));

        assert_eq!(status.unwrap().code(), 137);
    }

    #[test]
    fn a_normal_exit_keeps_its_code() {
        let status = Status::from_wait(WaitStatus::Exited(Pid::from_raw(2), 7));

        assert_eq!(status.unwrap().code(), 7);
    }

    #[test]
    fn stopped_and_continued_are_not_final() {
        let pid = Pid::from_raw(2);

        assert_eq!(Status::from_wait(WaitStatus::Stopped(pid, Signal::SIGSTOP)), None);
        assert_eq!(Status::from_wait(WaitStatus::Continued(pid)), None);
    }
}
