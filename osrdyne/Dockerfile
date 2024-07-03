# syntax=docker/dockerfile:1

##############
# Cargo chef #
##############
FROM lukemathwalker/cargo-chef:0.1.67-rust-latest AS chef
WORKDIR /app

#######################
# Cargo chef : Recipe #
#######################
FROM chef as planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

######################
# Cargo chef : build #
######################
FROM chef as run_builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo install --locked --path .

######################
# Testing env: build #
######################
FROM chef AS testing_env
RUN rustup component add llvm-tools && \
    rustup component add rustfmt && \
    rustup component add clippy && \
    cargo install --locked grcov
COPY --from=planner /app/recipe.json recipe.json

ENV RUSTFLAGS="-Cinstrument-coverage"
ENV LLVM_PROFILE_FILE="osrdyne-%p-%m.profraw"
RUN cargo chef cook --tests --recipe-path recipe.json
COPY . .

#######################
# Running env : build #
#######################
FROM debian:bookworm-slim as running_env
RUN apt update -yqq && \
    apt install -yqq --no-install-recommends curl ca-certificates libjemalloc2 jq && \
    apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false && \
    rm -rf /var/lib/apt/lists/*

COPY --from=run_builder /usr/local/cargo/bin/osrdyne /usr/local/bin/osrdyne

ARG OSRD_GIT_DESCRIBE
ENV OSRD_GIT_DESCRIBE=${OSRD_GIT_DESCRIBE}
# We use jemalloc to reduce allocation fragmentation
ENV LD_PRELOAD="/usr/lib/x86_64-linux-gnu/libjemalloc.so.2"

CMD ["/usr/local/bin/osrd_osrdyne"]
