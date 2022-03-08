FROM rust:1.59.0 as builder

WORKDIR /app
COPY . .
RUN cargo install --path .

FROM debian:buster-slim as runner

RUN apt update -yqq
RUN apt install -yqq --no-install-recommends libpq-dev curl
RUN apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/cargo/bin/editoast /usr/local/bin/editoast

CMD ["editoast", "runserver"]
