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
```

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
- **No async.** The shell is one straight-line busy-poll loop.

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

`cat` on `data` performs a live `ReadBlocks`; `echo ... > data` performs a
live `WriteBlocks` (padded/zero-filled to the device's block size, and
rejected if the content is longer than one block). This is not a
filesystem — there's no FAT/ext parser here — so writing to `data`
overwrites the device's first sector directly. Point it at your actual
boot disk and you will corrupt your boot disk; the `run.sh` script below
gives the shell two disposable scratch disks and a removable USB image so
there's always a safe target.

## Shell grammar

- `ls [path]` — list the current directory, or `path`. No flags.
- `cd [path]` — change directory. `..` and a leading `/` both mean "back
  to the root"; there's nothing to `cd` into below a device, since a
  device's contents are files, not subdirectories.
- `cat <file>` — print a file's contents. No flags, no redirection.
- `echo <text> [> file]` — print `text` to the console, or write it to
  `file` if redirected. `text` is exactly one of:
  - `'a single-quoted literal'` — taken byte-for-byte as ASCII; no
    backslash escapes are recognized inside the quotes.
  - a bare `\xBB\xBB...` sequence — each `\xNN` is one raw byte, hex
    encoded (so `\x48\x65\x6c\x6c\x6f` writes `Hello`).

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
