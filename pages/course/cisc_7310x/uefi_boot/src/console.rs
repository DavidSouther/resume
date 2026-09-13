//! Line-oriented console I/O over `EFI_SIMPLE_TEXT_INPUT/OUTPUT_PROTOCOL`.
//! No line-editing beyond backspace; that's plenty for a shell whose
//! commands are single lines.

use crate::efi::text::{SimpleTextInputProtocol, SimpleTextOutputProtocol};
use crate::efi::types::EFI_NOT_READY;
use alloc::string::String;

const CHAR_BACKSPACE: u16 = 0x08;
const CHAR_CARRIAGE_RETURN: u16 = 0x0D;
const CHAR_LINE_FEED: u16 = 0x0A;

/// Writes a `&str` to the console. Interior NULs truncate the string (the
/// protocol is NUL-terminated); everything else round-trips through UTF-16
/// a chunk at a time so there's no fixed line-length limit.
pub fn write_str(con_out: *mut SimpleTextOutputProtocol, s: &str) {
    let mut buf = [0u16; 128];
    let mut i = 0;
    for unit in s.encode_utf16() {
        buf[i] = unit;
        i += 1;
        if i == buf.len() - 1 {
            buf[i] = 0;
            unsafe { ((*con_out).output_string)(con_out, buf.as_ptr()) };
            i = 0;
        }
    }
    buf[i] = 0;
    unsafe { ((*con_out).output_string)(con_out, buf.as_ptr()) };
}

/// Writes raw bytes to the console, one byte per UTF-16 code unit (Latin-1
/// widening). `cat`/`echo` deal in bytes, not `str`, because a block
/// device's raw content isn't necessarily valid UTF-8 — this is the
/// lossy-but-simple way to still show something for it, and it round-trips
/// exactly for the ASCII text `echo` actually writes.
pub fn write_bytes(con_out: *mut SimpleTextOutputProtocol, bytes: &[u8]) {
    let mut buf = [0u16; 128];
    let mut i = 0;
    for &b in bytes {
        buf[i] = b as u16;
        i += 1;
        if i == buf.len() - 1 {
            buf[i] = 0;
            unsafe { ((*con_out).output_string)(con_out, buf.as_ptr()) };
            i = 0;
        }
    }
    buf[i] = 0;
    unsafe { ((*con_out).output_string)(con_out, buf.as_ptr()) };
}

/// Reads one line (Enter-terminated) from the keyboard, echoing keystrokes
/// and handling backspace. Busy-polls `ReadKeyStroke`, which is standard
/// practice for a UEFI app that hasn't set up the event/timer machinery —
/// see `EFI_NOT_READY` in the spec's description of that call.
pub fn read_line(con_in: *mut SimpleTextInputProtocol, con_out: *mut SimpleTextOutputProtocol) -> String {
    let mut line = String::new();
    loop {
        let mut key = crate::efi::text::InputKey {
            scan_code: 0,
            unicode_char: 0,
        };
        let status = unsafe { ((*con_in).read_key_stroke)(con_in, &mut key) };
        if status == EFI_NOT_READY {
            continue;
        }
        if key.scan_code != 0 {
            // Function/arrow keys etc. carry no printable char; ignore.
            continue;
        }
        match key.unicode_char {
            CHAR_CARRIAGE_RETURN | CHAR_LINE_FEED => {
                write_str(con_out, "\r\n");
                return line;
            }
            CHAR_BACKSPACE => {
                if line.pop().is_some() {
                    write_str(con_out, "\u{8} \u{8}");
                }
            }
            0 => {}
            c => {
                if let Some(ch) = char::from_u32(c as u32) {
                    line.push(ch);
                    let mut one = [0u8; 4];
                    write_str(con_out, ch.encode_utf8(&mut one));
                }
            }
        }
    }
}
