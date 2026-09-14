//! Line-oriented console I/O over `EFI_SIMPLE_TEXT_INPUT/OUTPUT_PROTOCOL`.
//! No line-editing beyond backspace; that's plenty for a shell whose
//! commands are single lines.

use crate::efi::text::{SimpleTextInputProtocol, SimpleTextOutputProtocol};
use crate::executor::ReadKey;
use alloc::string::String;

const CHAR_BACKSPACE: u16 = 0x08;
const CHAR_CARRIAGE_RETURN: u16 = 0x0D;
const CHAR_LINE_FEED: u16 = 0x0A;

/// Feeds a stream of UTF-16 code units to `OutputString` in fixed-size
/// chunks, so neither caller needs its own fixed-line-length limit. Shared
/// by [`write_str`] and [`write_bytes`] — they differ only in how a source
/// element becomes a `u16`, not in how the buffering/flushing works.
fn write_units(con_out: *mut SimpleTextOutputProtocol, units: impl Iterator<Item = u16>) {
    let mut buf = [0u16; 128];
    let mut i = 0;
    for unit in units {
        buf[i] = unit;
        i += 1;
        if i == buf.len() - 1 {
            buf[i] = 0;
            // SAFETY:
            // Operation: ((*con_out).output_string)(con_out, buf.as_ptr()).
            // Contract (EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL.OutputString, UEFI
            // spec §12.4): `this` valid; string pointer non-null, aligned
            // for `u16`, NUL-terminated.
            // Evidence:
            // - `con_out` traceable to `efi_main`'s validated
            //   `system_table.con_out` (trust-boundary policy, `efi/
            //   mod.rs`); `SimpleTextOutputProtocol`'s ABI-prefix invariant
            //   covers `output_string`.
            // - `buf` is a local, non-aliased stack array: `buf.as_ptr()`
            //   is non-null and aligned for `u16`.
            // - `buf[i] = 0` on the line above (LOCAL FACT), `i <
            //   buf.len() - 1` here, so the write is in-bounds and the
            //   string is terminated.
            // Postcondition: firmware has read `buf` up to the NUL;
            // `OutputString` takes it by const pointer, so `buf` itself is
            // unchanged.
            unsafe { ((*con_out).output_string)(con_out, buf.as_ptr()) };
            i = 0;
        }
    }
    buf[i] = 0;
    // SAFETY: same operation, contract, and evidence as above; `buf[i] =
    // 0` on the line above and `i <= buf.len() - 1` here too.
    unsafe { ((*con_out).output_string)(con_out, buf.as_ptr()) };
}

/// Writes a `&str` to the console. Interior NULs truncate the string (the
/// protocol is NUL-terminated); everything else round-trips through UTF-16
/// a chunk at a time so there's no fixed line-length limit.
pub fn write_str(con_out: *mut SimpleTextOutputProtocol, s: &str) {
    write_units(con_out, s.encode_utf16());
}

/// Writes raw bytes to the console, one byte per UTF-16 code unit (Latin-1
/// widening). `cat`/`echo` deal in bytes, not `str`, because a block
/// device's raw content isn't necessarily valid UTF-8 — this is the
/// lossy-but-simple way to still show something for it, and it round-trips
/// exactly for the ASCII text `echo` actually writes.
pub fn write_bytes(con_out: *mut SimpleTextOutputProtocol, bytes: &[u8]) {
    write_units(con_out, bytes.iter().map(|&b| b as u16));
}

/// Reads one line (Enter-terminated) from the keyboard, echoing keystrokes
/// and handling backspace. Each keystroke is awaited via [`ReadKey`]
/// rather than polled in a loop; see `crate::executor` and the README's
/// "I/O modes" section for what that buys over busy-calling
/// `ReadKeyStroke` directly.
pub async fn read_line(con_in: *mut SimpleTextInputProtocol, con_out: *mut SimpleTextOutputProtocol) -> String {
    let mut line = String::new();
    loop {
        let key = ReadKey(con_in).await;
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
