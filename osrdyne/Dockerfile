# syntax=docker/dockerfile:1

##############
# Cargo chef #
##############
FROM lukemathwalker/cargo-chef:0.1.67-rust-1.79.0-alpine AS chef
WORKDIR /osrdyne

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
COPY --from=planner /osrdyne/recipe.json recipe.json
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/osrdyne/target \
    cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/osrdyne/target \
    cargo install --locked --path .

######################
# Testing env: build #
######################
FROM chef AS testing_env
RUN rustup component add llvm-tools && \
    rustup component add rustfmt && \
    rustup component add clippy && \
    cargo install --locked grcov
COPY --from=planner /osrdyne/recipe.json recipe.json

ENV RUSTFLAGS="-Cinstrument-coverage"
ENV LLVM_PROFILE_FILE="osrdyne-%p-%m.profraw"
RUN cargo chef cook --tests --recipe-path recipe.json
COPY . .

#######################
# Running env : build #
#######################
FROM scratch
COPY --from=run_builder /usr/local/cargo/bin/osrdyne /osrdyne

ARG OSRD_GIT_DESCRIBE
ENV OSRD_GIT_DESCRIBE=${OSRD_GIT_DESCRIBE}

CMD ["/osrdyne"]
