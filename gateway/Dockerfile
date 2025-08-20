# syntax=docker/dockerfile:1

##############
# Cargo chef #
##############
FROM lukemathwalker/cargo-chef:0.1.72-rust-1.89-alpine3.22 AS chef
WORKDIR /gateway
ENV CARGO_HOME=/cargo_gateway
ENV PATH="/cargo_editoast/bin:$PATH"

#######################
# Cargo chef : Recipe #
#######################
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

######################
# Cargo chef : build #
######################
FROM chef AS run_builder
RUN apk add --no-cache musl-dev build-base jemalloc-dev openssl-dev mold
ENV RUSTFLAGS="-C link-arg=-fuse-ld=mold"
COPY --from=planner /gateway/recipe.json recipe.json
ARG CARGO_PROFILE=release
RUN --mount=type=cache,target=/cargo_gateway/registry \
    --mount=type=cache,target=/gateway/target \
    cargo chef cook --profile ${CARGO_PROFILE} --recipe-path recipe.json
COPY . .
RUN --mount=type=cache,target=/cargo_gateway/registry \
    --mount=type=cache,target=/gateway/target \
    cargo install --profile ${CARGO_PROFILE} --locked --path .

######################
# Testing env: build #
######################
FROM chef AS testing_env
RUN rustup component add llvm-tools && \
    rustup component add rustfmt && \
    rustup component add clippy && \
    cargo install grcov
COPY --from=planner /gateway/recipe.json recipe.json

ENV LLVM_PROFILE_FILE="gateway-%p-%m.profraw"
RUN cargo chef cook --tests --recipe-path recipe.json
COPY . .

#######################
# Running env : build #
#######################
FROM alpine:3.22 AS running_env
RUN apk add --no-cache curl ca-certificates bind-tools jq
WORKDIR /srv
COPY --from=run_builder /cargo_gateway/bin/osrd_gateway /usr/local/bin/osrd_gateway

ARG OSRD_GIT_DESCRIBE
ENV OSRD_GIT_DESCRIBE=${OSRD_GIT_DESCRIBE}
ENV OTEL_SERVICE_NAME="osrd-gateway"

CMD ["/usr/local/bin/osrd_gateway"]

#####################
# Build env : front #
#####################
FROM node:24-alpine AS front_build
WORKDIR /app

# Add build argument for skipping failed front
ARG SKIP_FRONT=0

# Fill build time values
ARG OSRD_GIT_DESCRIBE
ENV VITE_OSRD_GIT_DESCRIBE=${OSRD_GIT_DESCRIBE}

COPY --from=front_src . /app

# If SKIP_FRONT is set to 1, skip the front build
RUN --mount=type=cache,target=/root/.npm \
    if [ "$SKIP_FRONT" = "1" ]; then exit 0; else npm ci; fi

# Generate the licenses file and build
ENV NODE_OPTIONS="--max_old_space_size=4096"
RUN if [ "$SKIP_FRONT" = "1" ]; then \
    mkdir -p build; \
    echo '<html><body><h1>No front, as this image was built for running it in dev mode</h1></body></html>' > build/index.html; \
    else \
    (npm run generate-licenses && npm run build); \
    fi

#######################
# Running env : front #
#######################
FROM running_env AS front_running_env

# Copy the front
WORKDIR /srv
COPY --from=front_build /app/build /srv/front/

# Copy an example config file
COPY ./gateway.bundled.toml /srv/gateway.toml
COPY --chmod=755 ./entrypoint.sh /srv/entrypoint.sh
ENTRYPOINT ["/srv/entrypoint.sh"]
CMD ["/usr/local/bin/osrd_gateway"]
