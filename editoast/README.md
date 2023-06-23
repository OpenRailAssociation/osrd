# Editoast

[![Test Editoast](https://github.com/osrd-project/osrd/actions/workflows/editoast.yml/badge.svg)](https://github.com/osrd-project/osrd/actions/workflows/editoast.yml)
[![Codecov](https://codecov.io/gh/osrd-project/osrd/branch/dev/graph/badge.svg?token=O3NAHQ01NO&flag=editoast)](https://codecov.io/gh/osrd-project/osrd)

This service allow to edit an infrastructure using railjson schema.
It will apply modification and update generated data such as object geometry.

# Developer installation

## Requirements

- [rustup](https://rustup.rs/)
- [libpq](https://www.postgresql.org/docs/current/libpq.html)
- [openssl](https://www.openssl.org)
- [libgeos](https://libgeos.org/usage/install/)

## Steps

```sh
# We recommend to develop using nightly rust toolchain
$ rustup toolchain install nightly
# Set nightly as default for the project
$ rustup override set nightly
# Build and run
$ cargo build
$ cargo run -- runserver
```

## Tests

In order to run tests, you need to have a postgresql database running. 

To avoid thread conflicts while accessing the database, use the `--test-threads=1` option.

Finally, with target debug, the test threads overflow their stack. To avoid this, you can either increase the stack size with the `RUST_MIN_STACK` environment variable or use the release target.

```sh
cargo test --release -- --test-threads=1

# or

RUST_MIN_STACK=8388608 cargo test -- --test-threads=1
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
