FROM lukemathwalker/cargo-chef:latest AS chef
WORKDIR /app

FROM chef as planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef as builder

# geos crate requirement
RUN apt update -yqq &&  apt install -yqq --no-install-recommends libgeos-dev

COPY --from=planner /app/recipe.json recipe.json
COPY --from=planner /app/editoast_derive/ editoast_derive
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo install --locked --path .

FROM debian:bullseye-slim as runner

RUN apt update -yqq && \
    apt install -yqq --no-install-recommends libpq-dev curl ca-certificates libgeos-dev libjemalloc2 && \
    apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/cargo/bin/editoast /usr/local/bin/editoast

ARG OSRD_GIT_DESCRIBE
ENV OSRD_GIT_DESCRIBE=${OSRD_GIT_DESCRIBE}
# We use jemalloc to reduce allocation fragmentation
ENV LD_PRELOAD="/usr/lib/x86_64-linux-gnu/libjemalloc.so.2"
CMD ["editoast", "runserver"]
