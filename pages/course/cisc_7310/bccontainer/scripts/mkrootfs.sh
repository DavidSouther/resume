#!/usr/bin/env bash
# Extract a container image into ./containers/<name>/ for this machine's architecture.
# The image defaults to debian:bookworm-slim.
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
# The name becomes the container's hostname: bcdocker's hostname rule.
[[ -n $name && $name != */* && $name != . && $name != .. && $(LC_ALL=C; echo ${#name}) -le 64 ]] ||
  die "name must be 1 to 64 bytes, not . or .., with no /"
image=${2:-debian:bookworm-slim}
dest=containers/$name
[[ ! -e $dest ]] || die "$dest exists"

# Docker and crane both need the platform spelled out: crane defaults to linux/amd64.
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
# Checked again: mv into a directory that appeared during the build would nest inside it.
[[ ! -e $dest ]] || die "$dest exists"
mv "$tmp" "$dest"
