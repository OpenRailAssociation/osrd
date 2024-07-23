### Build train-sim dynamic lib (not used in core for now, but eventually will)
# Will be used for testing
FROM rust:latest AS train_sim_rust_env
WORKDIR /app

RUN rustup component add llvm-tools && \
    rustup component add rustfmt && \
    rustup component add clippy && \
    cargo install --locked grcov
ENV RUSTFLAGS="-Cinstrument-coverage"
ENV LLVM_PROFILE_FILE="train-sim-%p-%m.profraw"

COPY --from=train_sim_dir . .

RUN cargo build -p uniffi-bindgen --release
RUN cargo build -p train-sim --release --locked

#### Build layer for train-sim bindings testing
FROM gradle:8.0-jdk17 AS train_sim_gradle_env
WORKDIR /app
COPY --from=train_sim_rust_env /app/kotlin_bindings .
COPY --from=train_sim_rust_env /app/target/ ../target/
COPY --from=train_sim_rust_env /app/cross_language_tests/ ../cross_language_tests/

#### Build stage, will be used for testing as well
FROM gradle:8.0-jdk17 AS build_env

WORKDIR /home/gradle/src
COPY --from=test_data . /home/gradle/tests/data
COPY --chown=gradle:gradle . .
# Remove broken symlink (to prevent kaniko from crashing)
RUN --mount=type=cache,target=/home/gradle/.gradle \
    --mount=type=cache,target=/home/gradle/src/build \
    gradle shadowJar --no-daemon && \
    cp build/libs/osrd-all.jar / && \
    rm  -rf /root/.kotlin/daemon/kotlin-daemon.* /tmp/hsperfdata_root/ /tmp/kotlin-daemon.*

# Copy the train-sim package
COPY --from=train_sim_rust_env /app/kotlin_bindings/ /home/gradle/src/train_sim/
COPY --from=train_sim_rust_env /app/target/release/libtrain_sim.so /home/gradle/src/train_sim/libs/libtrain_sim.so

#### Running stage
FROM eclipse-temurin:21 AS running_env

COPY --from=build_env /osrd-all.jar /app/osrd_core.jar
ADD 'https://dtdg.co/latest-java-tracer' /app/dd-java-agent.jar
ADD 'https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar' /app/opentelemetry-javaagent.jar

ARG OSRD_GIT_DESCRIBE
ENV OSRD_GIT_DESCRIBE=${OSRD_GIT_DESCRIBE}

CMD ["sh", "-c", "exec java $JAVA_OPTS -ea -jar /app/osrd_core.jar api"]
