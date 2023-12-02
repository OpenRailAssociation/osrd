# OSRD's backend

This service allow to edit an infrastructure using railjson schema.
It will apply modification and update generated data such as object geometry.

# Developer installation

## Requirements

- [rustup](https://rustup.rs/)
- [libpq](https://www.postgresql.org/docs/current/libpq.html) (may be packaged as `libpq-dev`)
- [openssl](https://www.openssl.org)
- [libgeos](https://libgeos.org/usage/install/) (may be packaged as `libgeos-dev`)

## Steps

```sh
# apply database migration
$ cargo install diesel_cli --no-default-features --features postgres
$ diesel migration run
# Build and run
$ cargo build
$ cargo run -- runserver
```

## Tests

In order to run tests, you need to have a postgresql database and redis running.

To avoid thread conflicts while accessing the database, use the `--test-threads=1` option.

<!--- TODO: when tests are isolated, allow multiple threads (4 may be a good tradeoff for speed/DB pool)  --->

```sh
cargo test -- --test-threads=1
```

## Useful tools

Here a list of components to help you in your development:

 - [rustfmt](https://github.com/rust-lang/rustfmt): Format the whole code `cargo fmt`
 - [clippy](https://github.com/rust-lang/rust-clippy): Run a powerful linter `cargo clippy --all-features --all-targets -- -D warnings`
 - [tarpaulin](https://github.com/xd009642/tarpaulin): Check code coverage `cargo tarpaulin --skip-clean -o Lcov --output-dir target/tarpaulin/`

To install them simply run:
```sh
$ rustup component add rustfmt clippy
$ cargo install cargo-tarpaulin
```

## OpenApi generation

We have to keep the OpenApi of the service statically in the repository.
To make sure it is always valid a CI check has been set up. To update the
OpenApi when a change has been made to an endpoint, run the following command:

```sh
cargo run openapi > openapi.yaml
```
