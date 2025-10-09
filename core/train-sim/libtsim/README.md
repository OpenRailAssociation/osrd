# libtsim

libtsim simulates the behavior of a train along a given path, and according to
given schedule and driver behavior.

Languages bindings are provided by `tsim-ffi` using [uniffi].

## Usage

### From rust

For rust projects, add `tsim` to your dependencies:

```sh
cargo add tsim
```

### From other languages

For other languages (kotlin, python, ...) build `tsim-ffi` to produce the
shared library:

```sh
cargo build -p tsim-ffi --release
```

You can then generate the bindings for your language. Here is an example with
kotlin on linux. Make sure to use the correct path and extension for the
`tsim_ffi` library according to your platform:

```sh
cargo run -p uniffi-bindgen -- \
    generate \
    --library libtsim_ffi.so \
    --language kotlin \
    --out-dir out/src/main/kotlin
```

[uniffi]: https://github.com/mozilla/uniffi-rs
