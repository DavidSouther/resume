//! Shell-facing errors. `thiserror` is the project's one allowed
//! dependency (its `Display` impl lets these surface as one-line messages
//! the shell prints back at the prompt, the way a real shell reports
//! `cat: no such file or directory`).

use alloc::string::String;

#[derive(thiserror::Error, Debug)]
pub enum ShellError {
    #[error("no such file or directory: {0}")]
    NotFound(String),
    #[error("not a directory: {0}")]
    NotADirectory(String),
    #[error("not readable: {0}")]
    NotReadable(String),
    #[error("not writable: {0}")]
    NotWritable(String),
    #[error("unknown command: {0}")]
    UnknownCommand(String),
    #[error("usage: {0}")]
    Usage(String),
    #[error("firmware call failed (EFI_STATUS = 0x{0:x})")]
    Efi(usize),
}
