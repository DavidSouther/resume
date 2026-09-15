#!/usr/bin/env python3
"""Scripted driver for the qemu_boot shell over a UNIX-socket serial port.

Connects to the socket QEMU exposes for -chardev socket,...,path=<sock>,
sends each command in `commands` with a short settle delay, and prints
everything the guest wrote back."""

import socket
import sys
import time

sock_path, *commands = sys.argv[1:]

s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
for attempt in range(50):
    try:
        s.connect(sock_path)
        break
    except (FileNotFoundError, ConnectionRefusedError):
        time.sleep(0.2)
else:
    print("could not connect to", sock_path)
    sys.exit(1)

s.settimeout(0.3)


def drain():
    out = b""
    end = time.time() + 2.0
    while time.time() < end:
        try:
            chunk = s.recv(4096)
            if not chunk:
                break
            out += chunk
            end = time.time() + 0.4
        except socket.timeout:
            continue
    return out


# Let the firmware + app boot and reach the first prompt.
time.sleep(2.5)
sys.stdout.buffer.write(drain())
sys.stdout.flush()

for cmd in commands:
    s.sendall((cmd + "\r").encode())
    time.sleep(0.3)
    out = drain()
    sys.stdout.buffer.write(out)
    sys.stdout.flush()

s.close()
