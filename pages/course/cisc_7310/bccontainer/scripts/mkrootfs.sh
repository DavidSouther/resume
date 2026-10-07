#!/usr/bin/env bash
# Extract debian:bookworm-slim into ./containers/<name>/ for this machine's architecture.
#
#     scripts/mkrootfs.sh tinysys
#
# Uses Docker when its daemon is reachable, otherwise crane. The container is built in a
# temporary directory and renamed into place, so a failed build leaves nothing behind.

set -euo pipefail

die() { echo "mkrootfs: $*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

[[ $# -eq 1 ]] || die "usage: mkrootfs.sh <name>"
name=$1
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
  id=$(docker create --platform "linux/$arch" debian:bookworm-slim)
  docker export "$id" | tar -x -C "$tmp"
elif have crane; then
  crane export --platform "linux/$arch" debian:bookworm-slim - | tar -x -C "$tmp"
else
  die "install docker or crane"
fi

# mktemp creates the directory 0700; it becomes the container's /.
chmod 755 "$tmp"
mv "$tmp" "$dest"
