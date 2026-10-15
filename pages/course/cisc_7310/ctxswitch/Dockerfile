# Build stage: Rust on Debian. Run stage: debian:stable-slim, which is what the experiment is run on.
FROM rust:1-slim AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock* ./
COPY src ./src
RUN cargo build --release --locked 2>/dev/null || cargo build --release

FROM debian:stable-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends strace procps \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/ /opt/ctxswitch-build/
RUN for b in uctxswitch uctxmake uctxswap uctxrestore umthreaddemo switchbench; do \
      install -m 0755 /opt/ctxswitch-build/$b /usr/local/bin/$b; \
    done && rm -rf /opt/ctxswitch-build
CMD ["switchbench"]
