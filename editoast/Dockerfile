##############
# Cargo chef #
##############
FROM lukemathwalker/cargo-chef:0.1.67-rust-latest AS chef
WORKDIR /editoast

#######################
# Cargo chef : Recipe #
#######################
FROM chef as planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

######################
# Cargo chef : build #
######################
FROM chef as base_builder
# geos crate requirement
RUN apt update -yqq && apt install -yqq --no-install-recommends libgeos-dev mold
# Instal diesel_cli
RUN cargo install diesel_cli --no-default-features --features postgres

######################
# Testing env: build #
######################
FROM base_builder AS test_builder
RUN rustup component add llvm-tools && \
    rustup component add rustfmt && \
    rustup component add clippy && \
    cargo install --locked grcov
COPY --from=planner /editoast/recipe.json recipe.json
COPY --from=planner /editoast/editoast_derive/ editoast_derive
COPY --from=test_data . /tests/data

ENV RUSTFLAGS="-Cinstrument-coverage -C link-arg=-fuse-ld=mold"
ENV LLVM_PROFILE_FILE="editoast-%p-%m.profraw"
RUN cargo chef cook --tests --recipe-path recipe.json
COPY . .

#######################
# Running env : build #
#######################
FROM base_builder AS run_builder
COPY --from=planner /editoast/recipe.json recipe.json
COPY --from=planner /editoast/editoast_derive/ editoast_derive
ENV RUSTFLAGS="-C link-arg=-fuse-ld=mold"
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/editoast/target \
    cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/editoast/target \
    cargo install --locked --path .

###############
# Running env #
###############
FROM debian:bookworm-slim as running_env
RUN apt update -yqq && \
    apt install -yqq --no-install-recommends libpq-dev curl ca-certificates libgeos-dev libjemalloc2 && \
    apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false && \
    rm -rf /var/lib/apt/lists/*

COPY --from=run_builder /usr/local/cargo/bin/editoast /usr/local/bin/editoast
COPY --from=run_builder /usr/local/cargo/bin/diesel /usr/local/bin/diesel
COPY --from=run_builder /editoast/migrations /migrations
COPY --from=run_builder /editoast/assets /assets

ARG OSRD_GIT_DESCRIBE
ENV OSRD_GIT_DESCRIBE=${OSRD_GIT_DESCRIBE}
ENV ASSETS_PATH=/assets

# We use jemalloc to reduce allocation fragmentation
ENV LD_PRELOAD="/usr/lib/x86_64-linux-gnu/libjemalloc.so.2"
CMD ["editoast", "runserver"]
