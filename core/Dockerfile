FROM gradle:7.3.3-jdk17 AS build

WORKDIR /home/gradle/src
COPY --chown=gradle:gradle . .
RUN gradle shadowJar --no-daemon

FROM amazoncorretto:17

COPY --from=build /home/gradle/src/build/libs/osrd-all.jar /app/osrd_core.jar
CMD ["java", "-ea", "-jar", "/app/osrd_core.jar", "api"]
