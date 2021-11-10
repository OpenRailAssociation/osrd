FROM gradle:6.6.1-jdk11 AS build

WORKDIR /home/gradle/src
COPY --chown=gradle:gradle . .
RUN gradle shadowJar --no-daemon

FROM amazoncorretto:11

COPY --from=build /home/gradle/src/build/libs/*.jar /app/osrd_core.jar
CMD ["java", "-ea", "-jar", "/app/osrd_core.jar", "api"]
