# OSRD's backend

This service allow to edit an infrastructure using railjson schema.
It will apply modification and update generated data such as object geometry.

# Developer installation

## Requirements

For both tests or run:

- [rustup](https://rustup.rs/)
- [libpq](https://www.postgresql.org/docs/current/libpq.html) (may be packaged as `libpq-dev`)
- [openssl](https://www.openssl.org)
- [libgeos](https://libgeos.org/usage/install/) (may be packaged as `libgeos-dev`)
- A properly initialized postgresql database and a redis server: `docker compose up --no-build --detach postgres redis`

## Steps

```sh
# apply database migration
$ cargo install diesel_cli --no-default-features --features postgres
$ diesel migration run
# Build and run
$ cargo build
$ cargo run -- runserver
# Test server is up
$ curl -f http://localhost:8090/health
```

## Tests

To avoid thread conflicts while accessing the database, use the `--test-threads=1` option.

<!--- TODO: when tests are isolated, allow multiple threads (4 may be a good tradeoff for speed/DB pool)  --->

```sh
cargo test -- --test-threads=1
```

## Useful tools

Here a list of components to help you in your development (see CI jobs if necessary):

- [rustfmt](https://github.com/rust-lang/rustfmt): Format the whole code `cargo fmt`
- [clippy](https://github.com/rust-lang/rust-clippy): Run a powerful linter `cargo clippy --all-features --all-targets -- -D warnings`
- [grcov](https://github.com/mozilla/grcov): Check code coverage (see documentation on GitHub)

To install `rustfmt` and `clippy`, simply run:

```sh
rustup component add rustfmt clippy
```

To setup `grcov`, please see [its documentation](https://github.com/mozilla/grcov#how-to-get-grcov)

## OpenApi generation

We have to keep the OpenApi of the service statically in the repository.
To make sure it is always valid a CI check has been set up. To update the
OpenApi when a change has been made to an endpoint, run the following command:

```sh
cargo run openapi > openapi.yaml
```
