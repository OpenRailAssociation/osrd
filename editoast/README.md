# Editoast

This service allow to edit an infrastructure using railjson schema.
It will apply modification and update generated data such as object geometry.

# Developer installation

## Requirements

- [rustup](https://rustup.rs/)
- [libpq](https://www.postgresql.org/docs/current/libpq.html)

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