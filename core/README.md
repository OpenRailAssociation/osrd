# OSRD's Simulation backend

## Design Goals

* **Microscopic**: The movement of trains should be accurately simulated, as well as their interactions with interlocking / signaling
* **Readable**: The code must be kept to very high quality standards, so everyone can contribute
* **Modular**: Users should be able to easily integrate their own hardware and behaviors
* **Observable**: What happens in the simulation must be easy to monitor
* **Fast**: Simulating a full day of operation for 500+ trains shouldn't take hours

Many of these goals currently aren't _yet_ fulfilled: the simulation is pretty slow, and the feature set is very limited.

## Simulation roadmap

 - [x] Reasonably accurate simulation of train movement
 - [x] Import of railML3 infrastructure
 - [x] Static speed restrictions
 - [x] Full history of internal simulation events
 - [x] Basic interlocking / signaling support
 - [X] Make the train react to signals
 - [X] pathfinding in the route graph
 - [X] API server mode
 - [ ] ERTMS support
 - [ ] Parallel integration of train movement
 - [ ] Variable step integration
 - [ ] Driver behavior model
 - [ ] ~~Rewrite everything in Rust~~

## Getting Started

You'll need:
 - Java 11
 - Python >= 3.8 (For generating example / test files)

```sh
# on Linux / MacOS
./gradlew processTestResources shadowJar

# on Windows
gradlew.bat processTestResources shadowJar

java -jar build/libs/osrd-all.jar \
    simulate \
    --config build/resources/test/tiny_infra/config_railjson.json \
    -o sim_changelog_output.json
```
