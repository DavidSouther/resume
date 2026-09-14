# uefi_boot

A minimal aarch64 UEFI application: it reads device information straight
from firmware-provided protocols — the attached disk, the GPU, a
removable USB drive — and exposes it through a tiny sysfs-style shell.

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

That last pair — `cat` reading one device and redirecting straight into
another — is how you get data off the machine: point `>` at a removable
device's `data` file and whatever you `cat` (or `ls`) lands on its first
sector, ready to read back on another machine.

## Constraints this project is built to

- **Rust stable.** No nightly features.
- **One dependency: `thiserror`.** Everything else — including the UEFI
  bindings themselves — is hand-written, deliberately, rather than pulled
  in from the `uefi` or `r-efi` crates.
- **No custom device drivers.** Every device shown here (disk, GPU, USB
  stick) is reached through a protocol the UEFI spec requires firmware to
  implement: `EFI_BLOCK_IO_PROTOCOL` and `EFI_GRAPHICS_OUTPUT_PROTOCOL`.
  Nothing talks to AHCI, NVMe, USB mass storage, or a GPU register
  directly. "USB drive support" is just a Block IO handle whose
  `RemovableMedia` flag happens to be set — there's no USB stack code
  here at all.
- **No added async runtime.** Console input is `async`/`.await` now (see
  "I/O modes" below) — but that's `core::future::Future` and a
  hand-rolled 20-line executor, not `tokio` or `futures`. Still zero
  non-`thiserror` dependencies.

See `src/main.rs` for the fuller rationale, and `src/efi/` for the
bindings themselves — each file cites the UEFI Specification 2.10 section
its layout comes from.

## The device tree

Two levels, because that's all any of these devices need:

- `/` lists each discovered device (`blk0`, `blk1`, ... for Block IO
  handles; `gop0`, `gop1`, ... for Graphics Output handles).
- `/<device>/` lists that device's attribute files: `info` plus one file
  per field (`block_size`, `resolution`, ...) for read-only inspection,
  and — for block devices only — a `data` file that is the device's raw
  block 0, readable and writable.

`cat` on `data` performs a live `ReadBlocks`; redirecting into `data`
(from `echo`, or from any other command) performs a live `WriteBlocks`
(padded/zero-filled to the device's block size, and rejected if the
content is longer than one block). This is not a filesystem — there's no
FAT/ext parser here — so writing to `data` overwrites the device's first
sector directly. Point it at your actual boot disk and you will corrupt
your boot disk; the `run.sh` script below gives the shell two disposable
scratch disks and a removable USB image so there's always a safe target.

## Shell grammar

- `ls [path] [> file]` — list the current directory, or `path`. No flags.
- `cd [path]` — change directory. `..` and a leading `/` both mean "back
  to the root"; there's nothing to `cd` into below a device, since a
  device's contents are files, not subdirectories. `cd` produces no
  output, so `> file` on a `cd` is a usage error rather than silently
  doing nothing.
- `cat <file> [> file]` — print a file's contents. No flags.
- `echo <text> [> file]` — print `text` to the console. `text` is
  exactly one of:
  - `'a single-quoted literal'` — taken byte-for-byte as ASCII; no
    backslash escapes are recognized inside the quotes.
  - a bare `\xBB\xBB...` sequence — each `\xNN` is one raw byte, hex
    encoded (so `\x48\x65\x6c\x6c\x6f` writes `Hello`).

`> file` isn't an `echo`-only feature: every command's output is just
bytes, and every redirect target is just some device's `data` file, so
`ls`, `cat`, and `echo` all support it, and any of them can write across
devices (`cat /blk3/info > /blk0/data`). The one thing `> file` never
does is add anything — no extra newline gets appended to what's written,
so a redirected `cat` copies its source exactly. Printing to the console
still appends a trailing newline, same as before, purely for readability
at the prompt.

## I/O modes: where polling, interrupt, and DMA actually happen

This project started from [CISC7310X's lecture on I/O
schemes](https://huichen-cs.github.io/course/CISC7310X/26FA/lecture/ioscheme_interrupt),
which frames device I/O as three shapes: **polling** (the CPU repeatedly
asks "are you ready yet?"), **interrupt** (the device tells the CPU when
it's ready, instead), and **DMA** (the device moves bulk data itself,
without the CPU shuttling it byte by byte). All three are present here,
in one form or another. Two of them are code this project wrote, after
deliberately converting a polling loop into something closer to
interrupt-notified, using nothing but a standard Boot Services call and
about 20 lines of hand-rolled `Future`/executor plumbing.

**Interrupt-notified — `console::read_line` (`src/console.rs`) and
`src/executor.rs`.** Reading a keystroke used to be a tight loop around
`ReadKeyStroke`, asking "is a key ready? No. Is a key ready? No. ...".
It's now an `.await` instead:

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
that happens; the CPU is told, rather than asking on a schedule. That's
the actual difference from before: not the busy-loop's *frequency*, but
that there's no polling left in `uefi_boot`'s own code at all — the wait
is one blocking firmware call, not a spin.

This is also, structurally, the smallest possible async runtime:
`core::future::Future` needs a `Waker`, so `executor.rs` uses
`Waker::noop()` (there's only ever one task, so nothing ever needs
rescheduling — `WaitForEvent` returning *is* the wakeup) and
`alloc::boxed::Box::pin` to hold the `async fn`'s state machine (which
isn't `Unpin`, since it borrows across an `.await` point). No `tokio`,
no `futures` crate — `core::task` and about 20 lines. Console *output*
(`write_str`/`write_bytes` → `OutputString`) didn't change: it's still
one blocking call with no completion callback, because there was never
anything to wait *for* on that side.

**A real hardware interrupt handler — still one layer down, never in
this code.** This is the "???" the lecture leaves for the reader, and
waiting on `wait_for_key` doesn't actually answer it: `WaitForEvent` is
still firmware telling *us* when to stop waiting, not this project
taking an interrupt itself. Doing that for real means owning the
interrupt controller (GICv2/v3, on aarch64) — either via
`EFI_HARDWARE_INTERRUPT_PROTOCOL` (an edk2/ARM platform convention, not
in the UEFI Specification proper, so it only exists because this
project's firmware happens to be edk2-based) or by programming the GIC
directly, which is squarely the kind of custom device driver the brief
rules out. What actually happens now, same as before this change: a real
keyboard IRQ fires, firmware's own driver services it, buffers the
keystroke, and signals `wait_for_key` — and `uefi_boot` finds out only
because it asked to be told, not because anything interrupted it. The
interrupt is real; it's still exactly one layer further down than a
UEFI application is allowed to reach.

**DMA — `EFI_BLOCK_IO_PROTOCOL::{Read,Write}Blocks` (`src/shell.rs`).**
`read_block0`/`write_block0` hand firmware a buffer pointer and a length:

```rust
((*b.protocol).read_blocks)(b.protocol, b.media_id, 0, size, buf.as_mut_ptr() as *mut c_void);
```

and nothing else. We never move the bytes ourselves — that's the console
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

## Building

```sh
rustup target add aarch64-unknown-uefi   # once
cargo build --target aarch64-unknown-uefi
```

Produces `target/aarch64-unknown-uefi/debug/uefi_boot.efi`, a PE32+ image
for firmware to load as `EFI/BOOT/BOOTAA64.EFI`.

## Running under QEMU

```sh
qemu/run.sh
```

Needs `qemu-system-aarch64` and an aarch64 UEFI firmware image (Debian/
Ubuntu: `apt install qemu-system-arm ovmf`, which installs one at
`/usr/share/qemu-efi-aarch64/QEMU_EFI.fd`; override the path with
`UEFI_BOOT_FIRMWARE` if yours lives elsewhere). The script builds the
crate, assembles a FAT boot directory QEMU serves directly as a virtual
disk (`-drive file=fat:rw:esp,...`), creates two disposable raw disk
images on first run (a 4 MiB "hard drive" and a 2 MiB "USB stick", the
latter attached through a USB controller and marked removable), adds a
`virtio-gpu-pci` device for Graphics Output, and hands the guest's serial
console to your terminal.

`qemu/drive_shell.py` is a small development helper that drives the shell
over a UNIX-socket serial port non-interactively (used to script the
device/round-trip checks during development); it isn't part of the
shipped project.
