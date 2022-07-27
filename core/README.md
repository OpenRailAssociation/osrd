# OSRD's Simulation backend

[![Core](https://github.com/DGEXSolutions/osrd/actions/workflows/core.yml/badge.svg)](https://github.com/DGEXSolutions/osrd/actions/workflows/core.yml)
[![Codecov](https://codecov.io/gh/DGEXSolutions/osrd/branch/dev/graph/badge.svg?token=O3NAHQ01NO&flag=core)](https://codecov.io/gh/DGEXSolutions/osrd)

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
 - [X] Variable step integration
 - [ ] Driver behavior model
 - [ ] ~~Rewrite everything in Rust~~

## Getting Started

You'll need:
 - Java 17
 - Python >= 3.8 (For generating example / test files)
 - Install python requirements here: [examples/generated/lib/requirements.txt](examples/generated/lib/requirements.txt)

```sh
# on Linux / MacOS
./gradlew processTestResources shadowJar

# on Windows
gradlew.bat processTestResources shadowJar

# Run as service
java -jar build/libs/osrd-all.jar api -p 8080

# Check that an infra can be loaded
java -jar build/libs/osrd-all.jar load-infra --path RAILJSON_INFRA
```
