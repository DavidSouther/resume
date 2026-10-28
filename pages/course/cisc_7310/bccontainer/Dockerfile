# Development image for bcdocker: a Rust toolchain, plus strace and procps for the psstat
# experiment. rustup is used because Debian's rustc is older than rust-version in Cargo.toml.
# Toolchain and cargo caches live in /opt/rustup and /opt/cargo, which ./linux mounts as volumes.
FROM debian:stable-slim
RUN apt-get update && apt-get install -y \
    build-essential ca-certificates curl procps strace \
    && rm -rf /var/lib/apt/lists/*
ENV RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo PATH=/opt/cargo/bin:$PATH
RUN curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable
