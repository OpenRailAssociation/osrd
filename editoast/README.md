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
- [fga CLI](https://github.com/openfga/cli)

Additionally, editoast requires the following services to be running:

```sh
../osrd-compose up --detach openfga postgres rabbitmq valkey
```

## Steps

```sh
# apply osrd database migrations
$ cargo install diesel_cli --no-default-features --features postgres
$ diesel migration run --locked-schema  # avoids bumping modification date (then rebuild)
# apply openfga migrations
$ (cd fga_migrations && cargo run -- apply)
# build the assets
$ cargo install spreet
$ ./assets/sprites/generate-atlas.sh
$ cargo install build_pbf_glyphs
$ ./assets/fonts/generate-glyphs.sh
# Build and run
$ cargo build
$ cargo run -- runserver
# Test server is up
$ curl -f http://localhost:8090/health
```

## Tests

```sh
cargo test --workspace -- --test-threads=4
```

## Useful tools

Here a list of components to help you in your development (see CI jobs if necessary):

- [rustfmt](https://github.com/rust-lang/rustfmt): Format the whole code `cargo fmt --all`
- [taplo](https://taplo.tamasfe.dev/): Format the TOML files with `taplo fmt`
- [clippy](https://github.com/rust-lang/rust-clippy): Run a powerful linter `cargo clippy --workspace --all-features --all-targets -- -D warnings`
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

## Debugging

:warning: For improving compilation time and therefore the developer experience, the project
choose to strip out debug information by default, resulting in [about 10%
shorter compilation time](https://github.com/OpenRailAssociation/osrd/pull/13513).

If you need to debug the project, you might want to activate the `dev-for-debug` profile
which will build with debug information.

```
cargo build --profile dev-for-debug
```

### Tooling/IDE configurations

Here are some useful tips grouped by tool (click to expand).

<details>
  <summary>Visual Studio Code</summary>

  First, open only `./editoast` directory in VSCode:
  * allows finding `Cargo.toml` (it may be possible to configure work directory when necessary, though)
  * avoids loading all the projects (multiple cargo, npm, gradle) which consume lot of RAM and processor.

  Useful extensions:
  * `rust-analyzer`
  * `CodeLLDB` (did not try `LLDB DAP`)
  * `Rust Syntax`
  * `Even Better TOML`
  * `crates`
  * (`Rust Macro Expand`: not tested, but promising)

  For step-by-step debugging under VS Code, you need to change the debug level
  to `full` in order to get the variable content.

  This can be done by changing the **profile** in debugger launch tasks. \
  Here is an example of configurations to put in `launch.json` for `CodeLLDB` extension:
  ```json
          {
              "type": "lldb",
              "request": "launch",
              "name": "Debug single 'cargo test'",
              "cargo": {
                  "args": [
                      "test",
                      "--profile",
                      "dev-for-debug",
                      "--no-run",
                  ]
              },
              // optional tests name filter
              "args": ["create_locked_rolling_stock_successfully"]
          },
          {
              "type": "lldb",
              "request": "launch",
              "name": "Debug 'editoast runserver' no-cache/single-worker",
              "cargo": {
                  "args": [
                      "build",
                      "--profile",
                      "dev-for-debug",
                  ]
              },
              "env": {
                  "ROOT_URL": "http://localhost:4000/api",
                  "EDITOAST_CORE_SINGLE_WORKER": "true",
                  "EDITOAST_NO_CACHE": "true"
              },
              "args": ["runserver"],
              "cwd": "${workspaceFolder}"
          },
  ```
  Here is some configuration example of workspace's `settings.json` for
  `rust-analyzer`'s code lens (`▶️ Run Test | ⚙ Debug`):
  ```json
      "rust-analyzer.runnables.extraArgs": [
          "--profile=dev-for-debug"
      ]
  ```

  Note: it's also possible to pass environment variables to change the **debug
  level** of the profile used, but it's a bit less clean.

</details>

## No-cache mode

Running editoast with deactivated cache can help repeating calls when debugging.

```sh
EDITOAST_NO_CACHE=true cargo run -- runserver
```

If you run the stack with docker:

```sh
EDITOAST_NO_CACHE=true ./osrd-compose up -d
```

## Authorization

### How to disable authorizations

By default editoast is running with authorization enabled.
You can disable it by using the environment variable `EDITOAST_ENABLE_AUTHORIZATION=false`

```sh
EDITOAST_ENABLE_AUTHORIZATION=false cargo run -- runserver
```

If you run the stack with docker:

```sh
EDITOAST_ENABLE_AUTHORIZATION=false docker compose up
```

If your client has a direct access to editoast, an other possibility is to add the header `x-osrd-skip-authz` in your requests.

### User & role management

You can create a new user with `Admin` role by using the following commands :

```sh
cargo run user add 'mock/mocked' 'Example User'
cargo run roles add 'mock/mocked' Admin
```

Where `mock/mocked` is the **identity** of the user and `Example User` its **name**.
In development, the default user `mock/mocked` which is given by the gateway.

If you run the stack with docker, you can use:

```sh
docker exec osrd-editoast editoast user add 'mock/mocked' 'Example User'
docker exec osrd-editoast editoast roles add 'mock/mocked' Admin
```

## API's root URL

Editoast provides links to its own endpoints, and for those to be correct,
the `ROOT_URL` env-var should be specified to the client-facing root-URL
of editoast.

In the dev stack, its value is `http://localhost:4000/api` (after gateway's
configuration for own URL and editoast's prefix).

> [!TIP]
> Cartography issues:
> If your stack runs OK but can't display some data layers on maps (with
> editoast authz rejecting some requests), providing the correct `ROOT_URL` to
> editoast might be the solution.

## For M1 MacOS users

Our `docker-compose.yml` at the root of the project uses the `postgis` image by default.
For M1 macs, it requires emulation since it's not compiled for arm platforms, which results
in a significant slowdown. Define this variable in your environment or in a `.env` file somewhere:

```sh
export OSRD_POSTGIS_IMAGE='nickblah/postgis:16-postgis-3'
```

## Editoast diesel tables model update

After creating a new migration, one should update `database/src/tables.rs` with

```sh
$ diesel migration run  # without locking schema
```

## OpenApi generation

We have to keep the OpenApi of the service statically in the repository.
To make sure it is always valid a CI check has been set up. To update the
OpenApi when a change has been made to an endpoint, run the following command:

```sh
cargo run openapi > openapi.yaml
```

## Working with `editoast_derive`

We define some custom procedural macros in the `editoast_derive` crate. These rely on snapshot testing library [`insta`](https://insta.rs/). It basically works like this:

1. Change the output of a macro
2. Run the tests using `cargo test`
3. Since the output has changed, the test will fail, showing a diff of the old vs. new snapshot content. The new snapshot will be saved to disk with the extension `*.snap.new`.
4. If the new snapshot is correct, rename it to `*.snap` and commit it.

> [!TIP]
> You can use [`cargo-insta`](https://insta.rs/docs/cli/) to review pending snapshots and accept them conveniently.
>
> ```sh
> $ cargo insta review
> ```

For more information, visit the [`insta` documentation](https://insta.rs/docs/).
