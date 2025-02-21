##############
# Cargo chef #
##############
FROM lukemathwalker/cargo-chef:0.1.68-rust-1.84-alpine3.20 AS chef
WORKDIR /editoast

#######################
# Cargo chef : Recipe #
#######################
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

######################
# Cargo chef : build #
######################
FROM chef AS base_builder
RUN apk add --no-cache build-base openssl openssl-dev openssl-libs-static mold libpq-dev geos-dev
ENV RUSTFLAGS="-C target-feature=-crt-static -C link-arg=-fuse-ld=mold"
RUN cargo install diesel_cli --no-default-features --features postgres
COPY --from=static_assets . /assets

#######################
# Build assets        #
#######################
FROM chef AS editoast_assets
# build_pbf_glyphs requires a c++ compiler
RUN apk --no-cache add build-base
RUN cargo install spreet
RUN cargo install build_pbf_glyphs
COPY ./assets /assets
RUN /assets/sprites/generate-atlas.sh
RUN /assets/fonts/generate-glyphs.sh

######################
# Testing env: build #
######################
FROM base_builder AS test_builder
RUN rustup component add llvm-tools && \
    rustup component add rustfmt && \
    rustup component add clippy && \
    cargo install grcov

# install `fga` binary used in `crate fga` unit tests
RUN mkdir install \
    && cd install \
    && wget https://github.com/openfga/cli/releases/download/v0.6.4/fga_0.6.4_linux_amd64.tar.gz \
    && tar xf fga_0.6.4_linux_amd64.tar.gz \
    && mv fga /usr/local/bin \
    && cd .. \
    && rm -rf install

COPY --from=planner /editoast/recipe.json recipe.json
COPY --from=planner /editoast/editoast_derive/ editoast_derive
COPY --from=test_data . /tests/data
ENV RUSTFLAGS="-Cinstrument-coverage -C target-feature=-crt-static -C link-arg=-fuse-ld=mold"
ENV LLVM_PROFILE_FILE="editoast-%p-%m.profraw"
RUN cargo chef cook --tests --recipe-path recipe.json
COPY . .
COPY --from=editoast_assets /assets /editoast/assets

#######################
# Running env : build #
#######################
FROM base_builder AS run_builder
COPY --from=planner /editoast/recipe.json recipe.json
COPY --from=planner /editoast/editoast_derive/ editoast_derive
ARG CARGO_PROFILE=release
ARG CARGO_FEATURES
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/editoast/target \
    cargo chef cook --profile="${CARGO_PROFILE}" --recipe-path recipe.json
COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/editoast/target \
    cargo install --profile="${CARGO_PROFILE}" --locked --path .

###############
# Running env #
###############
FROM alpine:3.20 AS running_env
RUN apk add --no-cache jemalloc curl ca-certificates geos libpq openssl postgresql16-client

COPY --from=run_builder /usr/local/cargo/bin/editoast /usr/local/bin/editoast
COPY --from=run_builder /editoast/migrations /migrations
COPY --from=base_builder /usr/local/cargo/bin/diesel /usr/local/bin/diesel
COPY --from=base_builder /usr/local/bin/fga /usr/local/bin/fga
COPY --from=editoast_assets /assets /assets

ARG OSRD_GIT_DESCRIBE
ENV OSRD_GIT_DESCRIBE=${OSRD_GIT_DESCRIBE}
ENV OTEL_SERVICE_NAME="osrd-editoast"
ENV DYNAMIC_ASSETS_PATH=/assets

# We use jemalloc to reduce allocation fragmentation
ENV LD_PRELOAD="/usr/lib/libjemalloc.so.2"
# tower_http in debug mode allows to capture span from `tower_http::trace::TraceLayer` middleware
ENV RUST_LOG="info,tower_http=debug"
CMD ["editoast", "runserver"]
