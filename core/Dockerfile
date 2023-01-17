FROM gradle:7.5-jdk17 AS build

WORKDIR /home/gradle/src
COPY --chown=gradle:gradle . .

# Remove broken symlink (to prevent kaniko from crashing)
RUN gradle shadowJar --no-daemon && \
  rm  -rf /root/.kotlin/daemon/kotlin-daemon.* /tmp/hsperfdata_root/ /tmp/kotlin-daemon.*

FROM amazoncorretto:17

COPY --from=build /home/gradle/src/build/libs/osrd-all.jar /app/osrd_core.jar

ARG OSRD_GIT_DESCRIBE
ENV OSRD_GIT_DESCRIBE=${OSRD_GIT_DESCRIBE}

CMD ["java", "-ea", "-jar", "/app/osrd_core.jar", "api"]
