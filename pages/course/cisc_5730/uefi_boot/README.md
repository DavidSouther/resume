# uefi_boot

A minimal aarch64 UEFI shell. It reads device information directly
from firmware-provided protocols and exposes that information through
a tiny shell on over an sysfs-like interface.

```
/> ls
blk0/
blk1/
blk2/
blk3/
gop0/
gop1/
/> cd blk3
/blk3> cat info
kind: block
media_id: 0
block_size: 512
last_block: 8191
removable: false
read_only: false
logical_partition: false
media_present: true

/blk3> echo 'Hello UEFI' > data
/blk3> cat data
Hello UEFI
/blk3> cd ..
/> cat /blk3/info > /blk0/data
/> cat /blk0/data
kind: block
media_id: 0
block_size: 512
last_block: 8191
removable: false
read_only: false
logical_partition: false
media_present: true
```

To extract data, identify the block device whose `info` reports `removable: true`, then write to that device.

## Constraints

- **Rust stable.** No nightly features.
- **No EFI dependencies.** All UEFI code is in tree, though `thiserror`
  is used to simplify shell error handling.
- **No custom device drivers.** Every device supported through a protocol
  the UEFI spec, `EFI_BLOCK_IO_PROTOCOL` and `EFI_GRAPHICS_OUTPUT_PROTOCOL`.
  Nothing talks to AHCI, NVMe, USB mass storage, or a GPU register
  directly. "USB drive support" is just a Block IO handle whose
  `RemovableMedia` flag happens to be set — there's no USB stack code
  here at all.
- **BYO Executor.** Console input is `async`/`.await` with a
  20-line in-tree executor.

## The device tree

Two levels, because that's all any of these devices need:

- `/` lists each discovered device (`blk0`, `blk1`, ... for Block IO
  handles; `gop0`, `gop1`, ... for Graphics Output handles).
- `/<device>/` lists that device's attribute files: `info` plus one file
  per field (`block_size`, `resolution`, ...) for read-only inspection,
  and — for block devices only — a `data` file that is the device's raw
  block 0, readable and writable.

`cat` on `data` performs `ReadBlocks`; redirecting into `data` performs
`WriteBlocks` for a single block, padded & zero-filled to the device's
block size. This is not a filesystem, so writing to `data` overwrites the
device's first sector directly. Point it at an actual boot disk and it
will corrupt that boot disk; the `make run` target below gives the shell two
disposable scratch disks and a removable USB image so there's always a
safe target.

## Shell grammar

- `ls [path] [> file]` — list the current directory, or `path`. No flags.
- `cd [path]` — change directory. `..` and a leading `/` both mean "back
  to the root"; there's nothing to `cd` into below a device, since a
  device's contents are files, not subdirectories. `cd` produces no
  output, so `> file` on a `cd` is a usage error rather than silently
  doing nothing.
- `cat <file> [> file]` — print a file's contents. No flags.
- `echo <text> [> file]` — print `text` to the console. `text` is
  - `'a single-quoted literal'` — ASCII; no escape sequences are
    recognized inside the quotes.
  - a bare `\xBB\xBB...` sequence — each `\xNN` is one raw byte, hex
    encoded (so `\x48\x65\x6c\x6c\x6f` writes `Hello`).
- `halt` — request a firmware shutdown. Ctrl-C and Ctrl-D request the same
  shutdown immediately, without waiting for Enter.

## I/O modes: polling, interrupt, and DMA

This project started from [CISC7310X's lecture on I/O
schemes](https://huichen-cs.github.io/course/CISC7310X/26FA/lecture/ioscheme_interrupt),
which frames device I/O as three shapes: **polling** (the CPU repeatedly
asks "are you ready yet?"), **interrupt** (the device tells the CPU when
it's ready, instead), and **DMA** (the device moves bulk data itself,
without the CPU shuttling it byte by byte). All three are present here,
in one form or another.

**Interrupt-notified — `console::read_line` (`src/console.rs`) and
`src/executor.rs`.**

```rust
// console.rs — read one key
let key = ReadKey(con_in).await;

// executor.rs — poll it, and block on WaitForEvent whenever it's Pending
loop {
    if let Poll::Ready(value) = fut.as_mut().poll(&mut cx) {
        return value;
    }
    let mut events = [wait_event];
    let _ = unsafe { ((*boot_services).wait_for_event)(1, events.as_mut_ptr(), &mut index) };
}
```

`wait_event` is `SimpleTextInputProtocol::wait_for_key` — an `EFI_EVENT`
firmware signals the moment its own keyboard-servicing code (itself
driven by a real IRQ) buffers a keystroke. `WaitForEvent` blocks until
that happens.

This is also, structurally, the smallest possible async runtime:
`core::future::Future` needs a `Waker`, so `executor.rs` uses
`Waker::noop()` (there's only ever one task, so nothing ever needs
rescheduling — `WaitForEvent` returning *is* the wakeup) and
`alloc::boxed::Box::pin` to hold the `async fn`'s state machine (which
isn't `Unpin`, since it borrows across an `.await` point). No `tokio`,
no `futures` crate — `core::task` and about 20 lines.

**Hardware interrupt handler** `WaitForEvent` is
still firmware telling *us* when to stop waiting, not owning a dedicated
interrupt in tree.  Doing that for real means owning the
interrupt controller (GICv2/v3, on aarch64) — either via
`EFI_HARDWARE_INTERRUPT_PROTOCOL` (an edk2/ARM platform convention, not
in the UEFI Specification) or by programming the GIC
directly, instea of letting the firmware's own driver service
it, buffer the keystroke, and signalling  `wait_for_key` — and `uefi_boot` finds out only
because it asked to be told, not because anything interrupted it. The
interrupt is real; it's just exactly one layer further down than a
UEFI application is allowed to reach.

**DMA — `EFI_BLOCK_IO_PROTOCOL::{Read,Write}Blocks` (`src/shell.rs`).**
`read_block0`/`write_block0` hand firmware a buffer pointer and a length:

```rust
((*b.protocol).read_blocks)(b.protocol, b.media_id, 0, size, buf.as_mut_ptr() as *mut c_void);
```

The CPU never moves these bytes. We hand 

We never move the bytes ourselves — that's the console
path's job — we hand over a destination and a size, and whatever driver
is actually behind that handle (virtio-blk, USB mass storage, AHCI...)
moves the bulk data on its own, typically by pointing the controller at
the buffer's physical address and letting it write there directly. That
handoff — the CPU describes a transfer instead of performing it — is
DMA's defining shape, and `EFI_BLOCK_IO_PROTOCOL` is precisely the
abstraction boundary that hides the mechanism from us.

Graphics Output is built for the same shape —
`GraphicsOutputProtocolMode::frame_buffer_base` is meant to be a
CPU-writable region the GPU scans out of directly, no `Blt()` call
needed — but QEMU's `virtio-gpu-pci` reports `pixel_format: BltOnly` with
`frame_buffer_size: 0` (`cat info` on `gop0`/`gop1` shows it), meaning
this particular device declines that path entirely and requires `Blt()`
instead. `uefi_boot` never calls `Blt`, so GPU I/O here is read-only mode
metadata — neither polled, interrupted, nor DMA'd, just a struct we read.

## Installing prerequisites

```sh
make install
```

This requires `rustup`. On macOS it installs QEMU with Homebrew; on
Debian-based Linux it installs `qemu-system-arm`, `qemu-utils`, and
`qemu-efi-aarch64` with `apt-get`. It also installs Rust's
`aarch64-unknown-uefi` target. Debian package installation uses `sudo`
when not run as root.

## Building

```sh
rustup target add aarch64-unknown-uefi   # once
make build
```

Produces `target/aarch64-unknown-uefi/debug/uefi_boot.efi`, a PE32+ image,
and stages it at `qemu/esp/EFI/BOOT/BOOTAA64.EFI` for firmware to load.

## Running under QEMU

```sh
make run
```

Needs `qemu-system-aarch64` and an aarch64 UEFI firmware image (Debian/
Ubuntu: `apt install qemu-system-arm ovmf`, which installs one at
`/usr/share/qemu-efi-aarch64/QEMU_EFI.fd`; override the path with
`UEFI_BOOT_FIRMWARE` if yours lives elsewhere). The `run` target depends on
`build`, then creates two disposable raw disk images on first run (a
4 MiB "hard drive" and a 2 MiB "USB stick", the latter attached through
a USB controller and marked removable), adds a `virtio-gpu-pci` device
for Graphics Output, and hands the guest's serial console to your
terminal.

On macOS, Homebrew's QEMU formula includes the same aarch64 EDK2 firmware
under the filename `edk2-aarch64-code.fd`:

```sh
brew install qemu
UEFI_BOOT_FIRMWARE="$(brew --prefix qemu)/share/qemu/edk2-aarch64-code.fd" make run
```

The dynamic prefix works with both Apple Silicon and Intel Homebrew
installations.

`qemu/drive_shell.py` is a small development helper that drives the shell
over a UNIX-socket serial port non-interactively (used to script the
device/round-trip checks during development); it isn't part of the
shipped project.

## Appendices & LInkes

https://uefi.org/specs/UEFI/2.9_A