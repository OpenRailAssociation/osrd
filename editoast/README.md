# Editoast

[![Test Editoast](https://github.com/DGEXSolutions/osrd/actions/workflows/editoast.yml/badge.svg)](https://github.com/DGEXSolutions/osrd/actions/workflows/editoast.yml)
[![Codecov](https://codecov.io/gh/DGEXSolutions/osrd/branch/dev/graph/badge.svg?token=O3NAHQ01NO&flag=editoast)](https://codecov.io/gh/DGEXSolutions/osrd)

This service allow to edit an infrastructure using railjson schema.
It will apply modification and update generated data such as object geometry.

# Developer installation

## Requirements

- [rustup](https://rustup.rs/)
- [libpq](https://www.postgresql.org/docs/current/libpq.html)
- [openssl](https://www.openssl.org)

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

```sh
# limit threads to avoid test errors with database connections
cargo test
```

## Useful tools

Here a list of components to help you in your development:

 - [rustfmt](https://github.com/rust-lang/rustfmt): Format the whole code `cargo fmt`
 - [clippy](https://github.com/rust-lang/rust-clippy): Run a powerful linter `cargo clippy --all-features -- -D warnings`
 - [tarpaulin](https://github.com/xd009642/tarpaulin): Check code coverage `cargo tarpaulin --skip-clean -o Lcov --output-dir target/tarpaulin/`

To install them simply run:
```sh
$ rustup component add rustfmt clippy
$ cargo install cargo-tarpaulin
```
