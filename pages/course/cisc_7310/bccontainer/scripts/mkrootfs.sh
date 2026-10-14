#!/usr/bin/env bash
# Extract a container image into ./containers/<name>/ for this machine's architecture.
# The image defaults to debian:bookworm-slim. The name becomes the container's hostname, so it
# must be 1 to 64 bytes of UTF-8, not . or .., with no /; this script does not check the UTF-8.
#
#     scripts/mkrootfs.sh tinysys
#     scripts/mkrootfs.sh tinysys ubuntu:24.04
#
# Uses Docker when its daemon is reachable, otherwise crane. The container is built in a
# temporary directory and renamed into place, so a failed build leaves nothing behind.
# Run as root to keep the image's owners and setuid bits; as another user every file belongs
# to that user, which is enough for running commands as root inside.

set -euo pipefail

die() { echo "mkrootfs: $*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

[[ $# -eq 1 || $# -eq 2 ]] || die "usage: mkrootfs.sh <name> [image]"
name=$1
# bcdocker's hostname rule. The C locale makes ${#name} count bytes, as the kernel does.
[[ -n $name && $name != */* && $name != . && $name != .. && $(LC_ALL=C; echo ${#name}) -le 64 ]] ||
  die "name must be 1 to 64 bytes, not . or .., with no /"
image=${2:-debian:bookworm-slim}
dest=containers/$name
[[ ! -e $dest ]] || die "$dest exists"

# Spell out the platform so both fetch this machine's architecture: crane defaults to
# linux/amd64, and docker may reuse a cached image of another platform.
case $(uname -m) in
  x86_64 | amd64) arch=amd64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *) die "unsupported architecture $(uname -m)" ;;
esac

mkdir -p containers
tmp=$(mktemp -d "containers/.$name.XXXXXX")
trap 'rm -rf "$tmp"; [[ -z ${id:-} ]] || docker rm -f "$id" >/dev/null 2>&1 || true' EXIT

if have docker && docker info >/dev/null 2>&1; then
  id=$(docker create --platform "linux/$arch" "$image")
  docker export "$id" | tar -x -C "$tmp"
elif have crane; then
  crane export --platform "linux/$arch" "$image" - | tar -x -C "$tmp"
else
  die "install docker or crane"
fi

# mktemp creates the directory 0700; it becomes the container's /.
chmod 755 "$tmp"
# Checked again: mv into a directory that appeared during the build would nest inside it. This
# narrows that window but does not close it.
[[ ! -e $dest ]] || die "$dest exists"
mv "$tmp" "$dest"
