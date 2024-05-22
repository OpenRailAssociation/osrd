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

To avoid thread conflicts while accessing the database, use serial_test

```rust
#[test]
#[serial_test::serial]
```

```sh
cargo test -- --test-threads=4
```

## Useful tools

Here a list of components to help you in your development (see CI jobs if necessary):

- [rustfmt](https://github.com/rust-lang/rustfmt): Format the whole code `cargo fmt`
- [taplo](https://taplo.tamasfe.dev/): Format the TOML files with `taplo fmt`
- [clippy](https://github.com/rust-lang/rust-clippy): Run a powerful linter `cargo clippy --all-features --all-targets -- -D warnings`
- [grcov](https://github.com/mozilla/grcov): Check code coverage (see documentation on GitHub)

To install `rustfmt` and `clippy`, simply run:

```sh
rustup component add rustfmt clippy
```

To install `taplo`, run:

```sh
cargo install --locked taplo-cli
```

To setup `grcov`, please see [its documentation](https://github.com/mozilla/grcov#how-to-get-grcov)

## For M1 MacOS users

Our `docker-compose.yml` at the root of the project uses the `postgis` image by default.
For M1 macs, it requires emulation since it's not compiled for arm platforms, which results
in a significant slowdown. Define this variable in your environment or in a `.env` file somewhere:

```sh
export OSRD_POSTGIS_IMAGE='nickblah/postgis:16-postgis-3'
```

## OpenApi generation

We have to keep the OpenApi of the service statically in the repository.
To make sure it is always valid a CI check has been set up. To update the
OpenApi when a change has been made to an endpoint, run the following command:

```sh
cargo run openapi > openapi.yaml
```

## Batch dependency updates

We use dependabot on the project to notify when dependencies are outdated.
We do not use dependabot to automatically update dependencies, as we want to merge all updates at
once and review the changes (and avoid flooding `dev` branch with dependency-bump commits).

Here is the process to update dependencies:

1. Change the versions.
   - _If you're using VSCode_ you can install the [`serayuzgur.crates`](https://marketplace.visualstudio.com/items?itemName=serayuzgur.crates) extension and run the "update all dependencies" command.
     Make sure that the new chosen version is stable, and that loose constraints are not overwritten in your commit.
   - _If you're not_, you can go check the versions used by dependabot in [its PRs](https://github.com/OpenRailAssociation/osrd/pulls?q=is%3Aopen+label%3Aarea%3Aeditoast+label%3Adependencies) and update the versions manually.
2. Run `cargo update` to update the Cargo.lock file (even sub-dependencies).
3. Check that all [dependabot editoast PRs](https://github.com/OpenRailAssociation/osrd/pulls?q=is%3Aopen+label%3Aarea%3Aeditoast+label%3Adependencies) are included in your update.
4. Adapt the code to the new versions, if needed.
5. Create a PR with your changes, and link all dependabot PRs in the description.
