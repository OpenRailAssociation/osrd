FROM rustlang/rust:nightly as chef
WORKDIR /app
RUN cargo install cargo-chef

FROM chef as planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef as builder

COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo install --locked --path .

FROM debian:buster-slim as runner

RUN apt update -yqq
RUN apt install -yqq --no-install-recommends libpq-dev curl
RUN apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/cargo/bin/editoast /usr/local/bin/editoast

CMD ["editoast", "runserver"]
