# Train Simulator

This module is a work in progress.

It will be responsible for simulating the behavior of a train along a given path, and according to given schedule and behavior.

It will be documented on the [OSRD website](https://osrd.fr/en/docs/reference/design-docs/) once [this pull request](https://github.com/OpenRailAssociation/osrd-website/pull/168) is merged.

## Contributing

This is a rust library with bindings in kotlin, generated thanks to [uniffi](https://github.com/mozilla/uniffi-rs/). It will be used by [core](../core).

### Building the lib
    
```shell
cargo build --release --locked
```

### Building the kotlin bindings

```shell
cargo run -p uniffi-bindgen --release -- generate --library target/release/libtrain_sim.so --language kotlin --out-dir kotlin_bindings/src/main/kotlin
```

### Running the tests

The rust ones:
```shell
cargo test
```

The kotlin ones (tests that are based on the [cross_language_tests](cross_language_tests) folder, which are also run in rust):
```shell
cd kotlin_bindings
./gradlew test
```
Make sure you have built the lib before running the tests. If the compiled lib is not in `target/release/', you can specify the path to the parent folder of your lib with:
```shell
./gradlew test -Djna.library.path=your/path/to/lib
```
