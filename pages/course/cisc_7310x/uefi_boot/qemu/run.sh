#!/usr/bin/env bash
# Build uefi_boot and boot it under QEMU's aarch64 "virt" machine with a
# simulated hard drive, a removable USB stick, and a virtio GPU (Graphics
# Output Protocol). Run this from a real terminal -- it hands the guest's
# serial console to your stdio, so the shell's `ls`/`cd`/`cat`/`echo`
# prompt is interactive.
#
# Requires: cargo (target aarch64-unknown-uefi), qemu-system-aarch64, and
# the aarch64 UEFI firmware image (Debian/Ubuntu: `apt install
# qemu-system-arm ovmf`, which ships it at
# /usr/share/qemu-efi-aarch64/QEMU_EFI.fd).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

FIRMWARE="${UEFI_BOOT_FIRMWARE:-/usr/share/qemu-efi-aarch64/QEMU_EFI.fd}"
if [[ ! -f "$FIRMWARE" ]]; then
  echo "UEFI firmware not found at $FIRMWARE (set UEFI_BOOT_FIRMWARE to override)" >&2
  exit 1
fi

(cd .. && cargo build --target aarch64-unknown-uefi)

mkdir -p esp/EFI/BOOT
cp ../target/aarch64-unknown-uefi/debug/uefi_boot.efi esp/EFI/BOOT/BOOTAA64.EFI

[[ -f hdd.img ]] || qemu-img create -f raw hdd.img 4M
[[ -f usb.img ]] || qemu-img create -f raw usb.img 2M

exec qemu-system-aarch64 \
  -M virt -cpu cortex-a72 -m 512 \
  -bios "$FIRMWARE" \
  -drive file=fat:rw:esp,format=raw,media=disk \
  -drive file=hdd.img,format=raw,if=virtio \
  -device virtio-gpu-pci \
  -device qemu-xhci,id=xhci \
  -drive file=usb.img,format=raw,if=none,id=usbstick \
  -device usb-storage,drive=usbstick,removable=on \
  -display none -serial mon:stdio -no-reboot
