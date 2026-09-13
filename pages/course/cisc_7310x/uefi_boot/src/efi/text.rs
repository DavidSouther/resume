//! `EFI_SIMPLE_TEXT_INPUT_PROTOCOL` and `EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL`
//! (UEFI spec §12.3 / §12.4) — the console the shell reads and writes.

use super::types::Status;
use core::ffi::c_void;

/// `EFI_INPUT_KEY` (§12.3).
#[repr(C)]
#[derive(Clone, Copy)]
pub struct InputKey {
    pub scan_code: u16,
    pub unicode_char: u16,
}

type InputResetFn =
    extern "efiapi" fn(this: *mut SimpleTextInputProtocol, extended_verification: u8) -> Status;
type ReadKeyStrokeFn =
    extern "efiapi" fn(this: *mut SimpleTextInputProtocol, key: *mut InputKey) -> Status;

#[repr(C)]
pub struct SimpleTextInputProtocol {
    pub reset: InputResetFn,
    pub read_key_stroke: ReadKeyStrokeFn,
    /// `EFI_EVENT`, usable with `BootServices::wait_for_event`; unused here
    /// since we busy-poll `read_key_stroke` instead.
    pub wait_for_key: *mut c_void,
}

type OutputStringFn =
    extern "efiapi" fn(this: *mut SimpleTextOutputProtocol, string: *const u16) -> Status;

#[repr(C)]
pub struct SimpleTextOutputProtocol {
    reset: usize,
    pub output_string: OutputStringFn,
    // TestString, QueryMode, SetMode, SetAttribute, ClearScreen,
    // SetCursorPosition, EnableCursor, Mode all follow in the real
    // protocol but nothing here calls them.
}
