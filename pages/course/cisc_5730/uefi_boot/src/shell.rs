use crate::console::{write_bytes, write_str};
use crate::devices::{Device, DeviceKind};
use crate::efi::boot_services::BootServices;
use crate::efi::runtime_services::{RuntimeServices, EFI_RESET_SHUTDOWN};
use crate::efi::text::{SimpleTextInputProtocol, SimpleTextOutputProtocol};
use crate::efi::types::status_is_success;
use crate::error::ShellError;
use crate::executor;
use alloc::format;
use alloc::string::{String, ToString};
use alloc::vec;
use alloc::vec::Vec;
use core::ffi::c_void;

pub struct Shell {
    devices: Vec<Device>,
    /// `None` is the root; `Some(i)` means "inside `devices[i]`".
    cwd: Option<usize>,
}

impl Shell {
    pub fn new(devices: Vec<Device>) -> Self {
        Self { devices, cwd: None }
    }

    fn prompt(&self) -> String {
        match self.cwd {
            None => "/".to_string(),
            Some(i) => format!("/{}", self.devices[i].name),
        }
    }

    /// Interprets `path` from the root if starts with `/`, or relative to `self.cwd`.
    /// Segment `.` and `..` are normalized to their usual meanings.
    fn resolve_dir(&self, path: &str) -> Result<Option<usize>, ShellError> {
        let path = path.trim();
        let mut cur = if path.starts_with('/') { None } else { self.cwd };
        for seg in path.split('/').filter(|s| !s.is_empty()) {
            match seg {
                "." => {}
                ".." => cur = None,
                name => {
                    if cur.is_some() {
                        return Err(ShellError::NotADirectory(name.to_string()));
                    }
                    cur = Some(
                        self.devices
                            .iter()
                            .position(|d| d.name == name)
                            .ok_or_else(|| ShellError::NotFound(name.to_string()))?,
                    );
                }
            }
        }
        Ok(cur)
    }

    /// Splits `path` into (containing device, filename)
    fn resolve_file<'p>(&self, path: &'p str) -> Result<(usize, &'p str), ShellError> {
        let path = path.trim();
        let (dir, file) = match path.rsplit_once('/') {
            None => (self.cwd, path),
            Some(("", file)) => (None, file),
            Some((dir, file)) => (self.resolve_dir(dir)?, file),
        };
        if file.is_empty() {
            return Err(ShellError::Usage("path must name a file".into()));
        }
        let idx = dir.ok_or_else(|| ShellError::NotReadable(path.to_string()))?;
        Ok((idx, file))
    }

    fn cmd_ls(&self, arg: Option<&str>) -> Result<Vec<String>, ShellError> {
        let dir = match arg {
            Some(path) => self.resolve_dir(path)?,
            None => self.cwd,
        };
        Ok(match dir {
            None => self.devices.iter().map(|d| format!("{}/", d.name)).collect(),
            Some(i) => self
                .devices[i]
                .attribute_names()
                .iter()
                .map(|n| n.to_string())
                .collect(),
        })
    }

    fn cmd_cd(&mut self, arg: &str) -> Result<(), ShellError> {
        self.cwd = self.resolve_dir(arg)?;
        Ok(())
    }

    fn cmd_cat(&self, path: &str) -> Result<Vec<u8>, ShellError> {
        let (idx, name) = self.resolve_file(path)?;
        let device = &self.devices[idx];
        if name == "data" {
            return match &device.kind {
                DeviceKind::Block(b) => read_block0(b),
                DeviceKind::Gop(_) => Err(ShellError::NotReadable(path.to_string())),
            };
        }
        device
            .read_attribute(name)
            .map(String::into_bytes)
            .ok_or_else(|| ShellError::NotFound(path.to_string()))
    }

    fn emit(
        &self,
        content: &[u8],
        redirect: Option<String>,
        con_out: *mut SimpleTextOutputProtocol,
    ) -> Result<(), ShellError> {
        match redirect {
            None => {
                write_bytes(con_out, content);
                write_str(con_out, "\r\n");
                Ok(())
            }
            Some(path) => self.write_data_file(&path, content),
        }
    }

    fn write_data_file(&self, path: &str, content: &[u8]) -> Result<(), ShellError> {
        let (idx, name) = self.resolve_file(path)?;
        if name != "data" {
            return Err(ShellError::NotWritable(path.to_string()));
        }
        match &self.devices[idx].kind {
            DeviceKind::Block(b) => write_block0(b, content),
            DeviceKind::Gop(_) => Err(ShellError::NotWritable(path.to_string())),
        }
    }

    /// Reads and runs commands from the console until the shell requests a
    /// firmware shutdown.
    pub fn run(
        &mut self,
        con_in: *mut SimpleTextInputProtocol,
        con_out: *mut SimpleTextOutputProtocol,
        boot_services: *mut BootServices,
        runtime_services: *mut RuntimeServices,
    ) {
        // SAFETY: `con_in` from `efi_main`.
        // `SimpleTextInputProtocol`'s invariant covers `wait_for_key`.
        let wait_for_key = unsafe { (*con_in).wait_for_key };
        loop {
            write_str(con_out, &format!("{}> ", self.prompt()));
            let line = executor::block_on(boot_services, wait_for_key, crate::console::read_line(con_in, con_out));
            let line = match line {
                crate::console::ReadLineResult::Line(line) => line,
                crate::console::ReadLineResult::Halt => shutdown(runtime_services),
            };
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            if let Err(err) = self.dispatch(line, con_out, runtime_services) {
                write_str(con_out, &format!("{err}\r\n"));
            }
        }
    }

    fn dispatch(
        &mut self,
        line: &str,
        con_out: *mut SimpleTextOutputProtocol,
        runtime_services: *mut RuntimeServices,
    ) -> Result<(), ShellError> {
        let (command, redirect) = split_redirect(line)?;
        let (cmd, rest) = command
            .split_once(char::is_whitespace)
            .unwrap_or((command, ""));
        let rest = rest.trim();
        let output = match cmd {
            "halt" => {
                if !rest.is_empty() {
                    return Err(ShellError::Usage("halt takes no arguments".into()));
                }
                CommandOutput::Halt
            }
            "ls" => {
                let arg = if rest.is_empty() { None } else { Some(rest) };
                CommandOutput::Bytes(self.cmd_ls(arg)?.join("\r\n").into_bytes())
            }
            "cd" => {
                CommandOutput::ChangeDirectory(if rest.is_empty() { "/" } else { rest })
            }
            "cat" => {
                if rest.is_empty() {
                    return Err(ShellError::Usage("cat <file>".into()));
                }
                CommandOutput::Bytes(self.cmd_cat(rest)?)
            }
            "echo" => CommandOutput::Bytes(parse_echo(rest)?),
            other => return Err(ShellError::UnknownCommand(other.to_string())),
        };

        match (output, redirect) {
            (CommandOutput::Bytes(content), redirect) => self.emit(&content, redirect, con_out),
            (CommandOutput::ChangeDirectory(path), None) => self.cmd_cd(path),
            (CommandOutput::ChangeDirectory(_), Some(_)) => {
                Err(ShellError::Usage("cd produces no output to redirect".into()))
            }
            (CommandOutput::Halt, None) => shutdown(runtime_services),
            (CommandOutput::Halt, Some(_)) => {
                Err(ShellError::Usage("halt produces no output to redirect".into()))
            }
        }
    }
}

enum CommandOutput<'a> {
    Bytes(Vec<u8>),
    ChangeDirectory(&'a str),
    Halt,
}

fn shutdown(runtime_services: *mut RuntimeServices) -> ! {
    // SAFETY:
    // Operation: dereference `runtime_services` and call `ResetSystem`.
    // Contract (EFI_RUNTIME_SERVICES.ResetSystem, UEFI spec §8.5): the
    // runtime-services table and its function pointer are valid while the
    // image runs; `ResetData` may be null when `DataSize` is zero.
    // Evidence: `runtime_services` is copied from the validated system table
    // in `efi_main` and passed unchanged through `Shell::run`; this image
    // never calls `ExitBootServices` or changes the table pointer.
    unsafe {
        ((*runtime_services).reset_system)(EFI_RESET_SHUTDOWN, 0, 0, core::ptr::null())
    }
}

/// Splits a command line at its first unquoted `>`. Redirection belongs to
/// the shell grammar rather than to any one command, so dispatch can route
/// every command's output through the same destination logic. Single quotes
/// are the only quoting syntax in this shell; tracking them here keeps a `>`
/// inside an `echo 'literal'` argument from becoming a redirect.
fn split_redirect(line: &str) -> Result<(&str, Option<String>), ShellError> {
    let mut in_single_quote = false;
    for (index, ch) in line.char_indices() {
        match ch {
            '\'' => in_single_quote = !in_single_quote,
            '>' if !in_single_quote => {
                let command = line[..index].trim();
                let target = line[index + ch.len_utf8()..].trim();
                if target.is_empty() {
                    return Err(ShellError::Usage("> needs a filename".into()));
                }
                return Ok((command, Some(target.to_string())));
            }
            _ => {}
        }
    }
    Ok((line.trim(), None))
}

fn read_block0(b: &crate::devices::BlockDevice) -> Result<Vec<u8>, ShellError> {
    let size = (b.block_size.max(1)) as usize;
    let mut buf = vec![0u8; size];
    // SAFETY:
    // Operation: deref `b.protocol`, call `read_blocks` through it.
    // Contract (EFI_BLOCK_IO_PROTOCOL.ReadBlocks, UEFI spec §13.9):
    // `this` valid; `buffer` valid for writes of `buffer_size` bytes.
    // Evidence:
    // - `b.protocol` traces to `HandleProtocol`'s FIRMWARE CONTRACT for
    //   BLOCK_IO_PROTOCOL_GUID (devices.rs::enumerate), and is never
    //   reassigned after `BlockDevice` construction (LOCAL FACT) — this
    //   crate never calls `ExitBootServices`, so the protocol interface
    //   stays live for the rest of the program per that same contract.
    // - `buf` is a local, non-aliased `Vec<u8>` of length exactly `size`
    //   (`vec![0u8; size]`, LOCAL FACT), so `buf.as_mut_ptr()` is valid
    //   for writes of exactly `size == buffer_size` bytes.
    // Postcondition: on success, firmware has written `size` bytes into
    // `buf`; `buf`'s length/capacity are unaffected (this call never
    // reallocates `buf`, only writes through the pointer).
    let status =
        unsafe { ((*b.protocol).read_blocks)(b.protocol, b.media_id, 0, size, buf.as_mut_ptr() as *mut c_void) };
    if !status_is_success(status) {
        return Err(ShellError::Efi(status));
    }
    Ok(buf)
}

fn write_block0(b: &crate::devices::BlockDevice, content: &[u8]) -> Result<(), ShellError> {
    if b.read_only {
        return Err(ShellError::NotWritable("data".into()));
    }
    let size = (b.block_size.max(1)) as usize;
    if content.len() > size {
        return Err(ShellError::Usage(format!(
            "{} bytes will not fit in one {size}-byte block",
            content.len()
        )));
    }
    let mut buf = vec![0u8; size];
    buf[..content.len()].copy_from_slice(content);
    // SAFETY: same protocol-validity evidence as `read_blocks` in
    // `read_block0`. Contract (WriteBlocks, UEFI spec §13.9): `buffer`
    // valid for reads of `buffer_size` bytes — `buf.len() == size ==
    // buffer_size` (LOCAL FACT, same construction as `read_block0`).
    let status = unsafe {
        ((*b.protocol).write_blocks)(b.protocol, b.media_id, 0, size, buf.as_ptr() as *const c_void)
    };
    if !status_is_success(status) {
        return Err(ShellError::Efi(status));
    }
    // SAFETY: same protocol-validity evidence as above; `FlushBlocks`
    // (UEFI spec §13.9) takes only `this`, no buffer to justify. Its
    // status is deliberately discarded — `WriteBlocks` already succeeded
    // above, and there's nothing more useful this shell can do with a
    // flush failure than report the write as done, matching the same
    // discard-on-purpose pattern `executor::block_on` uses for
    // `WaitForEvent`'s status. Not a soundness concern either way: no
    // later code branches on whether the flush ran.
    let _ = unsafe { ((*b.protocol).flush_blocks)(b.protocol) };
    Ok(())
}

/// Parses `echo`'s argument grammar: a single-quoted ASCII literal (no
/// escapes recognized inside, per spec) or a bare sequence of `\xBB` byte
/// escapes. Redirection has already been removed by [`split_redirect`].
fn parse_echo(args: &str) -> Result<Vec<u8>, ShellError> {
    let args = args.trim_start();
    let (content, rest): (Vec<u8>, &str) = if let Some(after_quote) = args.strip_prefix('\'') {
        let end = after_quote
            .find('\'')
            .ok_or_else(|| ShellError::Usage("unterminated ' quote".into()))?;
        let literal = &after_quote[..end];
        if !literal.is_ascii() {
            return Err(ShellError::Usage("quoted echo text must be ascii".into()));
        }
        (literal.as_bytes().to_vec(), &after_quote[end + 1..])
    } else {
        let end = args.find(char::is_whitespace).unwrap_or(args.len());
        (parse_byte_escapes(&args[..end])?, &args[end..])
    };

    let rest = rest.trim();
    if !rest.is_empty() {
        return Err(ShellError::Usage(format!("unexpected trailing text: {rest}")));
    }
    Ok(content)
}

fn parse_byte_escapes(token: &str) -> Result<Vec<u8>, ShellError> {
    if token.is_empty() {
        return Err(ShellError::Usage(
            "echo needs a 'quoted string' or \\xBB byte sequence".into(),
        ));
    }
    if !token.is_ascii() {
        return Err(ShellError::Usage("\\xBB sequence must be ascii".into()));
    }
    let bytes = token.as_bytes();
    let mut out = Vec::with_capacity(bytes.len() / 4);
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] != b'\\' || bytes.get(i + 1) != Some(&b'x') {
            return Err(ShellError::Usage(format!(
                "expected \\xNN at offset {i} in {token}"
            )));
        }
        let hex = token
            .get(i + 2..i + 4)
            .ok_or_else(|| ShellError::Usage("truncated \\xNN escape".into()))?;
        let value = u8::from_str_radix(hex, 16)
            .map_err(|_| ShellError::Usage(format!("invalid hex digits in \\x{hex}")))?;
        out.push(value);
        i += 4;
    }
    Ok(out)
}
