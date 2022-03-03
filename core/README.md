# OSRD's Simulation backend

## Design Goals

* **Microscopic**: The movement of trains should be accurately simulated, as well as their interactions with interlocking / signaling
* **Readable**: The code must be kept to very high quality standards, so everyone can contribute
* **Modular**: Users should be able to easily integrate their own hardware and behaviors
* **Observable**: What happens in the simulation must be easy to monitor
* **Fast**: Simulating a full day of operation for 500+ trains shouldn't take hours

Many of these goals currently aren't _yet_ fulfilled:  the feature set is pretty limited.

## Getting Started

You'll need:
 - Java 11
 - Python >= 3.8 (For generating example / test files)

```sh
# on Linux / MacOS
./gradlew processTestResources shadowJar

# on Windows
gradlew.bat processTestResources shadowJar

java -jar build/libs/osrd-all.jar http-server -p 8080
```
