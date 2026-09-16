.DEFAULT_GOAL := build

TARGET := aarch64-unknown-uefi
EFI_IMAGE := target/$(TARGET)/debug/uefi_boot.efi
ESP_IMAGE := qemu/esp/EFI/BOOT/BOOTAA64.EFI

ifeq ($(shell uname -s),Darwin)
UEFI_BOOT_FIRMWARE ?= $(shell brew --prefix qemu 2>/dev/null)/share/qemu/edk2-aarch64-code.fd
else
UEFI_BOOT_FIRMWARE ?= /usr/share/qemu-efi-aarch64/QEMU_EFI.fd
endif

.PHONY: install build run run-loop

install:
	@command -v rustup >/dev/null 2>&1 || { \
		echo "rustup is required; install it from https://rustup.rs first" >&2; \
		exit 1; \
	}
	@case "$$(uname -s)" in \
		Darwin) \
			command -v brew >/dev/null 2>&1 || { \
				echo "Homebrew is required; install it from https://brew.sh first" >&2; \
				exit 1; \
			}; \
			brew install qemu; \
			;; \
		Linux) \
			if [ ! -f /etc/debian_version ]; then \
				echo "Unsupported Linux distribution; make install supports Debian-based systems" >&2; \
				exit 1; \
			fi; \
			if [ "$$(id -u)" -eq 0 ]; then \
				sudo_cmd=""; \
			elif command -v sudo >/dev/null 2>&1; then \
				sudo_cmd="sudo"; \
			else \
				echo "Root privileges or sudo are required to install Debian packages" >&2; \
				exit 1; \
			fi; \
			$$sudo_cmd apt-get update; \
			$$sudo_cmd apt-get install -y qemu-system-arm qemu-utils qemu-efi-aarch64; \
			;; \
		*) \
			echo "Unsupported operating system: $$(uname -s)" >&2; \
			exit 1; \
			;; \
	esac
	rustup target add $(TARGET)

build:
	cargo build --target $(TARGET) $(CARGO_FEATURES)
	mkdir -p $(dir $(ESP_IMAGE))
	cp $(EFI_IMAGE) $(ESP_IMAGE)

run: build
	@test -f "$(UEFI_BOOT_FIRMWARE)" || { \
		echo "UEFI firmware not found at $(UEFI_BOOT_FIRMWARE) (set UEFI_BOOT_FIRMWARE to override)" >&2; \
		exit 1; \
	}
	@test -f qemu/hdd.img || qemu-img create -f raw qemu/hdd.img 4M
	@test -f qemu/usb.img || qemu-img create -f raw qemu/usb.img 2M
	@rm -f qemu/cpu_usage.log qemu/qemu.pid
	( while [ ! -s qemu/qemu.pid ]; do sleep 0.1; done; \
	  qemu_pid=$$(cat qemu/qemu.pid); \
	  while kill -0 $$qemu_pid 2>/dev/null; do \
		ps -o %cpu= -p $$qemu_pid 2>/dev/null; \
		sleep 1; \
	  done > qemu/cpu_usage.log ) & \
	monitor_pid=$$!; \
	qemu-system-aarch64 \
		-M virt -cpu cortex-a72 -m 512 \
		-bios "$(UEFI_BOOT_FIRMWARE)" \
		-pidfile qemu/qemu.pid \
		-drive file=fat:rw:qemu/esp,format=raw,media=disk \
		-drive file=qemu/hdd.img,format=raw,if=virtio \
		-device virtio-gpu-pci \
		-device qemu-xhci,id=xhci \
		-drive file=qemu/usb.img,format=raw,if=none,id=usbstick \
		-device usb-storage,drive=usbstick,removable=on \
		-display none -serial mon:stdio -no-reboot; \
	kill $$monitor_pid 2>/dev/null; \
	echo "host CPU%% samples for this run: qemu/cpu_usage.log"

# Same as `run`, but built with the `polling` feature: `executor::block_on`
# busy-spins on `read_key_stroke` instead of blocking in `WaitForEvent`. Use
# this to compare host CPU usage against the default, event-driven `run`.
run-loop: CARGO_FEATURES := --features polling
run-loop: run
