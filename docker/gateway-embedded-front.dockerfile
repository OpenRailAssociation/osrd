# syntax=docker/dockerfile:1

### FRONT BUILD STAGE

FROM node:18-alpine as front_build

WORKDIR /app

# Build dependencies
COPY --from=front package.json yarn.lock /app/
RUN yarn install

# Generate the licenses file and build
COPY --from=front . /app
RUN yarn generate-licenses && yarn build

### GATEWAY BUILD STAGE

FROM lukemathwalker/cargo-chef:latest AS chef
WORKDIR /app

# Prepare the recipe
FROM chef as planner
COPY --from=gateway . .
RUN cargo chef prepare --recipe-path recipe.json


# Build the project
FROM chef as gateway_builder
COPY --from=planner /app/recipe.json recipe.json
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo chef cook --release --recipe-path recipe.json

COPY --from=gateway . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo install --locked --path .


### SERVE STAGE

FROM debian:bookworm-slim
RUN apt-get update -yqq && \
    apt-get install -yqq --no-install-recommends curl ca-certificates libjemalloc2 jq && \
    apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false && \
    rm -rf /var/lib/apt/lists/*
# We use jemalloc to reduce allocation fragmentation
ENV LD_PRELOAD="/usr/lib/x86_64-linux-gnu/libjemalloc.so.2"

# Copy gateway binary
COPY --from=gateway_builder /usr/local/cargo/bin/osrd_gateway /usr/local/bin/osrd_gateway

ARG OSRD_GIT_DESCRIBE
ENV OSRD_GIT_DESCRIBE=${OSRD_GIT_DESCRIBE}

# Copy the front
WORKDIR /srv
COPY --from=front_build /app/build /srv/front/

# Copy an example config file
COPY --from=gateway ./gateway.prod.sample.toml /gateway.sample.toml
COPY --chmod=755 ./gateway-entrypoint.sh /srv/entrypoint.sh
ENTRYPOINT ["/srv/entrypoint.sh"]
CMD ["/usr/local/bin/osrd_gateway"]
