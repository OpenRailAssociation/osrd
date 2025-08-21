<p align="center">
  <a href="https://osrd.fr/en/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="/assets/branding/osrd_small_dark.svg">
      <img width="340px" style="max-width: 100%;" src="/assets/branding/osrd_small.svg" alt="OSRD Logo" alt="OSRD logo">
    </picture>
  </a>
&nbsp;&nbsp;
  <a href="https://publiccode.eu/">
    <img src="assets/PMPC_badge.svg" width="110px" alt="Public Money Public Code"/>
  </a>
</p>

<p align="center">
  <a href="https://osrd.fr/en/docs/guides/contribute/"><img src="https://img.shields.io/github/contributors-anon/OpenRailAssociation/osrd" alt="Contributors badge" /></a>
  <a href="https://github.com/OpenRailAssociation/osrd/blob/dev/LICENSE"><img src="https://img.shields.io/badge/license-LGPL-blue.svg" alt="LGPL License badge" /></a>
  <a href="https://github.com/OpenRailAssociation/osrd/actions/workflows/build.yml"><img src="https://github.com/OpenRailAssociation/osrd/actions/workflows/build.yml/badge.svg" alt="Build Status" /></a>
  <a href="https://api.reuse.software/info/github.com/OpenRailAssociation/osrd"><img src="https://api.reuse.software/badge/github.com/OpenRailAssociation/osrd" alt="REUSE status" /></a>
  <a href="https://github.com/OpenRailAssociation/technical-committee/blob/main/incubation-process.md"><img src="https://openrailassociation.org/badges/openrail-project-stage-2.svg" alt="Openrail Incubation Stage" /></a>
</p>

## What is OSRD?

OSRD (Open Source Railway Designer) is an open source web application for railway infrastructure design,
capacity analysis, timetabling and simulation and short term path request.

It's free and open-source forever!

Learn more about the project on [osrd.fr](https://osrd.fr/en/).

## ⚠️ Development status

OSRD is still in active development.
User and programming interfaces are not entirely stable and are still occasionally modified.
If you rely on OSRD, be prepared to deal with regular changes.

## Languages

OSRD support multiple languages. Here is the translation status for the different languages.
Integrated means that users can actually activate the language in the application.
If you want to contribute to the translation, you can do so easily with [Weblate](https://hosted.weblate.org/engage/osrd/).

| **Language**  |                                                          **Status**                                                         | **Integrated** |
|---------------|:---------------------------------------------------------------------------------------------------------------------------:|:--------------:|
| 🇬🇧 English       | [![Translation status](https://hosted.weblate.org/widget/osrd/-/en/svg-badge.svg)](https://hosted.weblate.org/engage/osrd/) |        ✅      |
| 🇫🇷 French        | [![Translation status](https://hosted.weblate.org/widget/osrd/-/fr/svg-badge.svg)](https://hosted.weblate.org/engage/osrd/) |        ✅      |
| 🇩🇪 German        | [![Translation status](https://hosted.weblate.org/widget/osrd/-/de/svg-badge.svg)](https://hosted.weblate.org/engage/osrd/) |        ✅      |
| 🇵🇹 Portuguese    | [![Translation status](https://hosted.weblate.org/widget/osrd/-/pt/svg-badge.svg)](https://hosted.weblate.org/engage/osrd/) |        ✅      |
| 🇪🇸 Spanish       | [![Translation status](https://hosted.weblate.org/widget/osrd/-/es/svg-badge.svg)](https://hosted.weblate.org/engage/osrd/) |        ❌      |

## Getting Started

To compile and run the application with an example infrastructure:

```sh
# build and run the entire stack
docker compose up -d --build

# import an small example infrastructure ("small_infra")
./scripts/load-railjson-infra.sh small_infra tests/data/infras/small_infra/infra.json

# import rolling stocks with realistic characterics, representative of the industry
./scripts/load-railjson-rolling-stock.sh tests/data/rolling_stocks/realistic/*.json --force

# import more rolling stocks
./scripts/load-railjson-rolling-stock.sh tests/data/rolling_stocks/*.json

# open the web app
xdg-open http://localhost:4000/
```

(Linux or WSL users can use `./osrd-compose host` instead of `docker compose` to enable host networking - useful to launch services in a debugger)

## Working on a single component

Each component has a _justfile_ to run usual developpment tasks. Install [just](https://github.com/casey/just#installation) and run it to see available recipes. All the components include:

* run
* install
* test
* format
* lint
* fix-lint

## Deployment

To deploy the application on a server, check out the [deployment guide](https://osrd.fr/en/docs/guides/deploy/).

## Get in touch

Send an email at <contact@osrd.fr>, [open an issue](https://github.com/OpenRailAssociation/osrd/issues/new?labels=kind%3Aquestion&template=question.yaml), or join the [#public-general:osrd.fr](https://matrix.to/#/#public-general:osrd.fr) matrix channel.

## Sponsors

<p align="center">
  <img src="assets/sponsors/ministere-amenagement-territoire-decentralisation.png" width="150px" height="150px" alt="Ministère de l'Aménagement du Territoire et de la Décentralisation"/>
  <img src="assets/sponsors/european-union.svg" width="150px" height="150px" alt="European Union"/>
  <img src="assets/sponsors/sncf-reseau.svg" width="150px" height="150px" alt="SNCF Réseau"/>
</p>

## License

OSRD is licensed under the GNU Lesser General Public License v3.0, see LICENSE.

Copyright © 2022 The OSRD Contributors
