#!/usr/bin/env bash
# Run a cargo command inside a Linux container (the crate does not build on macOS).
#   ./scripts-dev.sh test --release
#   CTXSWITCH_PLATFORM=linux/amd64 ./scripts-dev.sh test --release   (emulated x86_64, correctness only)
set -eu
cd "$(dirname "$0")"
vol=ctxswitch-target${CTXSWITCH_PLATFORM:+-${CTXSWITCH_PLATFORM//\//-}}
exec docker run --rm -v "$PWD":/src -v "$vol":/src/target -v ctxswitch-cargo:/usr/local/cargo/registry \
  -w /src ${CTXSWITCH_PLATFORM:+--platform "$CTXSWITCH_PLATFORM"} rust:1-slim cargo "$@"
