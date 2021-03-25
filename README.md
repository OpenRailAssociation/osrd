[![OSRD](assets/branding/osrd_small.svg)](https://github.com/DGEXSolutions/osrd)

[![license](https://img.shields.io/badge/license-LGPL-blue.svg)](https://github.com/DGEXSolutions/osrd-core/blob/dev/LICENSE)

OSRD's Simulation backend

## What is OSRD?

OSRD is a work in progress tool meant to help design and operate railway infrastructure.
It's built around a simulator, which evaluates a timetable on a given infrastructure.

It's free and open-source forever!

## WARNING

OSRD is still in the _very_ early stages of development.
APIs can and will change (now is the time to make suggestions!).
Important features are missing. Documentation is sparse.
Please don't build any serious projects with OSRD unless you are prepared to be broken by API changes constantly.

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
 - [ ] Make the train react to signals
 - [ ] pathfinding in the route graph
 - [ ] ERTMS support
 - [ ] Parallel integration of train movement
 - [ ] Variable step integration
 - [ ] Driver behavior model
 - [ ] API server mode
 - [ ] ~~Rewrite everything in Rust~~

## Getting Started

You'll need:
 - Java 11
 - gradle 6

```sh
gradle shadowJar
java -jar build/libs/osrd-all.jar \
    simulate \
    --config examples/simple/config.json \
    -o sim_changelog_output.json
```

## Contributing

If you think OSRD doesn't quite fit your needs yet, but still believe it could,
please [tell us about your needs](https://github.com/DGEXSolutions/osrd/issues/new).

Please consider committing resources to help development if you'd like to use OSRD in production.
Code contributions are very welcome, and we'd love to work together to make this project better.

## Thanks

We would like to thank:

 - Bjørnar Steinnes Luteberget, who wrote a very interesting thesis on the matter,
   as well as a [pretty impressive prototype](https://github.com/luteberget/junction)
 - The [railML](https://www.railml.org/) organisation, for making the namesake file format
