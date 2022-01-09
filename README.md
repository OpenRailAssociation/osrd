[![OSRD](assets/branding/osrd_small.svg)](https://github.com/DGEXSolutions/osrd)

[![license](https://img.shields.io/badge/license-LGPL-blue.svg)](https://github.com/DGEXSolutions/osrd/blob/dev/LICENSE)
[![Integration](https://github.com/DGEXSolutions/osrd/actions/workflows/integration_tests.yml/badge.svg)](https://github.com/DGEXSolutions/osrd/actions/workflows/integration_tests.yml)
[![Core](https://github.com/DGEXSolutions/osrd/actions/workflows/core.yml/badge.svg)](https://github.com/DGEXSolutions/osrd/actions/workflows/core.yml)
[![API](https://github.com/DGEXSolutions/osrd/actions/workflows/api.yml/badge.svg)](https://github.com/DGEXSolutions/osrd/actions/workflows/api.yml)
[![Front](https://github.com/DGEXSolutions/osrd/actions/workflows/front.yml/badge.svg)](https://github.com/DGEXSolutions/osrd/actions/workflows/front.yml)

## What is OSRD?

OSRD is a work in progress tool meant to help design and operate railway infrastructure.
It's built around a simulator, which evaluates a timetable on a given infrastructure.

It's free and open-source forever!

## WARNING

OSRD is still in the early stages of development.
APIs can and will change (now is the time to make suggestions!).
Important features are missing. Documentation is sparse.
Please don't build any serious projects with OSRD unless you are prepared to be broken by API changes.

## Getting Started

### What you'll need

- [Docker Compose](https://github.com/docker/compose)

You can find install process right [here](https://docs.docker.com/compose/install/).

Run this command in root of this project should start the docker :
```sh
docker-compose up
```

Note that it may take a little while the first time you run it.

You can now go to [http://localhost:3000](http://localhost:3000/) and should see the main front page.

### Miscellaneous

- [Front](front/README.md)
- [Api](api/README.md)
- [Core](core/README.md)
- [Tests](tests/README.md)

## Contributing

If you think OSRD doesn't quite fit your needs yet, but still believe it could,
please [tell us about your needs](https://github.com/DGEXSolutions/osrd/issues/new).

Please consider committing resources to help development if you'd like to use OSRD in production.
Code contributions are very welcome, and we'd love to work together to make this project better.

## Thanks

We would like to thank:

- Bjørnar Steinnes Luteberget, who wrote a very interesting thesis on the matter,
  as well as a [pretty impressive prototype](https://github.com/luteberget/junction)

## Contact

You are interested in the project, and you want to know more? Contact us at <contact@osrd.fr>.
