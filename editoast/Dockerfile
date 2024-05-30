##############
# Cargo chef #
##############
FROM lukemathwalker/cargo-chef:latest-rust-latest AS chef
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
FROM chef as base_builder
# geos crate requirement
RUN apt update -yqq && apt install -yqq --no-install-recommends libgeos-dev mold

################
# Test builder #
################
FROM base_builder AS test_builder
RUN apt update -yqq && apt install -yqq --no-install-recommends jq
RUN rustup component add llvm-tools
COPY --from=planner /app/recipe.json recipe.json
COPY --from=planner /app/editoast_derive/ editoast_derive
COPY --from=test_data . /tests/data

ENV RUSTFLAGS="-Cinstrument-coverage -C link-arg=-fuse-ld=mold"
ENV LLVM_PROFILE_FILE="editoast-%p-%m.profraw"
RUN cargo chef cook --tests --recipe-path recipe.json
COPY . .

RUN <<EOF
mkdir -p /test-programs
cargo test --workspace --no-run --message-format=json | \
    jq -r 'select(.reason == "compiler-artifact" and .profile.test) | .executable' | \
    xargs install -t /test-programs
ls -la /test-programs
EOF

###############
# Built tests #
###############

FROM scratch AS tests
COPY --from=test_builder /test-programs/* /

#######################
# Running env : build #
#######################
FROM base_builder AS run_builder
RUN cargo install diesel_cli --no-default-features --features postgres

COPY --from=planner /app/recipe.json recipe.json
COPY --from=planner /app/editoast_derive/ editoast_derive
ENV RUSTFLAGS="-C link-arg=-fuse-ld=mold"
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo install --locked --path .

###############
# Running env #
###############
FROM debian:bookworm-slim as running_env
RUN <<EOF
set -e
apt-get update -yqq
apt-get install -yqq --no-install-recommends libpq-dev curl ca-certificates libgeos-dev libjemalloc2
apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false
rm -rf /var/cache/apt/* /var/lib/apt/lists/*
EOF

COPY --from=run_builder /usr/local/cargo/bin/editoast /usr/local/bin/editoast
COPY --from=run_builder /usr/local/cargo/bin/diesel /usr/local/bin/diesel
COPY --from=run_builder /app/migrations /migrations
COPY --from=run_builder /app/assets /assets

ARG OSRD_GIT_DESCRIBE
ENV OSRD_GIT_DESCRIBE=${OSRD_GIT_DESCRIBE}
ENV ASSETS_PATH=/assets

# We use jemalloc to reduce allocation fragmentation
ENV LD_PRELOAD="/usr/lib/x86_64-linux-gnu/libjemalloc.so.2"
CMD ["editoast", "runserver"]
