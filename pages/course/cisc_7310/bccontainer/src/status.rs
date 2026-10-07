//! What the host shell sees: the application's exit code, or 128 plus the signal.

use nix::sys::wait::WaitStatus;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Status(u8);

impl Status {
    /// `Exited` gives the code, `Signaled` gives 128 + the signal; other statuses are not final.
    pub fn from_wait(_w: WaitStatus) -> Option<Status> {
        todo!()
    }

    pub fn code(self) -> u8 {
        self.0
    }
}
