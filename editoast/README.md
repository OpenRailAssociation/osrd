# Editoast

This service allow to edit an infrastructure using railjson schema.
It will apply modification and update generated data such as object geometry.

# Developer installation

## Requirements

- [rustup](https://rustup.rs/)
- [libpq](https://www.postgresql.org/docs/current/libpq.html)
- [openssl](https://www.openssl.org)

## Steps

```sh
# Install nightly rust toolchain
$ rustup toolchain install nightly
# Set nightly as default for the project
$ rustup override set nightly
# Build and run
$ cargo build
$ cargo run -- runserver
```

## Useful tools

Here a list of components to help you in your development:

 - [rustfmt](https://github.com/rust-lang/rust-clippy): Format the whole code `cargo fmt`
 - [clippy](): Run a powerful linter `cargo clippy`

To install them simply run:
 ```
 $ rustup component add rustfmt clippy
 ```
