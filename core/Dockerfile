#### Build stage, will be used for testing as well
FROM gradle:8.0-jdk17 AS build_env

WORKDIR /home/gradle/src
COPY --from=test_data . /home/gradle/tests/data
COPY --chown=gradle:gradle . .
# Remove broken symlink (to prevent kaniko from crashing)
RUN gradle shadowJar --no-daemon && \
  rm  -rf /root/.kotlin/daemon/kotlin-daemon.* /tmp/hsperfdata_root/ /tmp/kotlin-daemon.*

#### Running stage
FROM eclipse-temurin:21 AS running_env

COPY --from=build_env /home/gradle/src/build/libs/osrd-all.jar /app/osrd_core.jar
ADD 'https://dtdg.co/latest-java-tracer' /app/dd-java-agent.jar
ADD 'https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar' /app/opentelemetry-javaagent.jar

ARG OSRD_GIT_DESCRIBE
ENV OSRD_GIT_DESCRIBE=${OSRD_GIT_DESCRIBE}

CMD ["sh", "-c", "exec java $JAVA_OPTS -ea -jar /app/osrd_core.jar api"]
