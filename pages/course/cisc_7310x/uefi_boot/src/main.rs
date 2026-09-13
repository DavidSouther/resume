//! A minimal aarch64 UEFI application that reads device information (disk,
//! GPU, and removable USB media) straight from firmware-provided protocols
//! and exposes it through a tiny `ls`/`cd`/`cat`/`echo` shell, sysfs-style.
//!
//! ## Why hand-rolled bindings instead of the `uefi` crate
//!
//! The brief for this project is explicit: the only crate dependency is
//! `thiserror`, for error types. The [`efi`] module is this project's own
//! transcription of the handful of UEFI Specification 2.10 structures and
//! protocols it needs (§4.3 System Table, §4.4 Boot Services, §12.3/12.4
//! console, §12.9 Graphics Output, §13.9 Block IO) — not a general-purpose
//! UEFI binding, just exactly what this shell touches.
//!
//! ## Why no device drivers
//!
//! Every device this shell shows — the attached disk, the GPU, a
//! removable USB drive — is reached through a UEFI protocol firmware
//! already implements (`EFI_BLOCK_IO_PROTOCOL`, `EFI_GRAPHICS_OUTPUT_PROTOCOL`).
//! Nothing here talks to AHCI, NVMe, USB mass storage, or a GPU register
//! directly; "removable USB drive" support is just a `BlockIoMedia` handle
//! whose `RemovableMedia` flag happens to be set, not a USB driver.
//!
//! ## Why an async executor, of all things, in a "minimal" project
//!
//! Console input used to be a busy-loop around `ReadKeyStroke`. That's
//! polling, and it's the only I/O mode this project could reach without
//! either writing an interrupt handler (out of scope — see the README) or
//! waiting on the keystroke event `SimpleTextInputProtocol` already
//! hands us. Waiting on that event, though, is UEFI's async primitive:
//! `CreateEvent`'s notify callback and `WaitForEvent`'s block-until-
//! signaled are both "resume me later, not now" — which is exactly what
//! `core::future::Future` models. So [`console::read_line`] is an
//! `async fn`, and [`executor`] is the smallest thing that can drive one:
//! one `Future`, one no-op `Waker` (there's only ever one task, so nothing
//! needs real rescheduling), and a `WaitForEvent` call standing in for a
//! scheduler. It's still zero non-`thiserror` dependencies — no `tokio`,
//! no `futures`, just `core::task`.
#![no_std]
#![no_main]

extern crate alloc;

mod alloc_impl;
mod console;
mod devices;
mod efi;
mod error;
mod executor;
mod shell;

use core::panic::PanicInfo;
use efi::types::{Handle, Status, EFI_SUCCESS};
use shell::Shell;

/// # Safety
///
/// The caller (firmware, per the UEFI Specification's image entry point
/// contract, §4.1) must ensure `system_table` is non-null, aligned for
/// `SystemTable`, and points to a live `EFI_SYSTEM_TABLE` whose real
/// layout matches this crate's [`efi::system_table::SystemTable`] for at
/// least the fields this crate declares — the ABI-prefix invariant, see
/// `efi/mod.rs` — for as long as this function runs. There is no other
/// caller: firmware invokes this exactly once, as the image's entry point.
///
/// SAFETY (attribute): `#[no_mangle]` makes the linker find this function
/// under the literal symbol name `efi_main`, which the `aarch64-unknown-
/// uefi` target spec designates as the PE entry symbol. No other symbol in
/// this crate, or in its one dependency `thiserror`, is named `efi_main`,
/// so there is no name clash to make the entry point ambiguous.
#[no_mangle]
pub unsafe extern "efiapi" fn efi_main(
    _image_handle: Handle,
    system_table: *mut efi::system_table::SystemTable,
) -> Status {
    // SAFETY:
    // Operation: `&*system_table` (reference creation from a raw pointer).
    // Contract: the pointee must be non-null, aligned, and a valid,
    // fully-initialized `SystemTable` for the `&SystemTable`'s lifetime
    // (this statement).
    // Evidence: exactly this function's own `# Safety` precondition above,
    // which places that obligation on our one caller, firmware. Nothing
    // between entry and this line can have invalidated it.
    let table = unsafe { &*system_table };
    let con_out = table.con_out;
    let con_in = table.con_in;
    let boot_services = table.boot_services;

    // SAFETY: `boot_services` is `system_table.boot_services`, valid per
    // this function's own `# Safety` contract for as long as this program
    // runs; this is the only call to `init`, and it happens before the
    // first allocation (nothing above this line allocates).
    unsafe { alloc_impl::init(boot_services) };

    console::write_str(
        con_out,
        "uefi_boot: minimal device-info shell\r\ncommands: ls, cd, cat, echo\r\n",
    );

    let devices = devices::enumerate(boot_services);
    console::write_str(
        con_out,
        &alloc::format!("found {} device(s)\r\n", devices.len()),
    );

    Shell::new(devices).run(con_in, con_out, boot_services);

    // `Shell::run` never returns (there is no `exit`), but the type
    // checker still wants a `Status` here.
    EFI_SUCCESS
}

/// This target's panic strategy is `abort` (no unwinding, no personality
/// routine to write), so there's nothing to clean up here — just stop.
/// Printing a diagnostic would need a global console handle threaded in
/// just for this path, which is more plumbing than a device-info shell's
/// panic handler is worth.
#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}
