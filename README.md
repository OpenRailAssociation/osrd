<<<<<<< HEAD
# osrd

## Using the API

Using the API requires getting an API token at https://cerbere.dev.dgexsol.fr/

The API base URL is at https://gateway.dev.dgexsol.fr/osrd/

```sh
curl -H "Authorization: bearer ${API_TOKEN}" https://gateway.dev.dgexsol.fr/osrd/${ENDPOINT}
```

The infrastructure API revolves around the concepts of entities and components:

 - an entity has a type, a unique identifying number, and components
 - each component has, depending on its type, a number of fields
 - entities are declared with a fixed set of allowed components

### Creating a new infrastructure

```sh
curl -X POST -H 'Content-Type: application/json' -d @- ${BASE}/infra/ <<EOF
{"name": "test infra"}
EOF
```

### Creating entities

Entities live in a given infrastructure, which must be given as a URL parameter

```sh
curl -X POST -H 'Content-Type: application/json' -d @- ${BASE}/infra/${INFRA_ID}/edit/ <<EOF
[
    {
        "operation": "create_entity",
        "entity_type": "track_section",
        "components": [
            {
                "component_type": "track_section",
                "component": {"length": 42}
            },
            {
                "component_type": "identifier",
                "component": {"database": "gaia", "name": "Test."}
            },
            {
                "component_type": "geo_line_location",
                "component": {
                    "geographic": {"type":"LineString","coordinates":[[42, 42],[43, 42]]},
                    "schematic": {"type":"LineString","coordinates":[[42, 42],[43, 42]]}
                }
            }
        ]
    }
]
EOF
```

**Beware, dragons! Some entities have mandatory components, but this isn't yet enforced.**


### Querying entities by ID

```sh
curl ${BASE}/ecs/entity/track_section/${TRACK_SECTION_ENTITY_ID}/
```


### Adding components

```sh
curl -X POST -H 'Content-Type: application/json' -d @- ${BASE}/infra/${INFRA_ID}/edit/ <<EOF
[
    {
        "operation": "add_component",
        "entity_id": ${ENTITY_ID},
        "component_type": "identifier",
        "component: {"database": "gaia", "name": "FooBar"}
    }
]
EOF
```


### Querying entities by geographical position

This is a test endpoint, a cached version is provided by chartis. Any geojson object can be used as a bounding box:

```sh
curl "${BASE}/infra/1/geojson/?query=%7B%0A%22type%22%3A%22Polygon%22%2C%0A%22coordinates%22%3A%5B%0A%5B%0A%5B-27.303581%2C-48.458352%5D%2C%0A%5B106.373722%2C-48.458352%5D%2C%0A%5B106.373722%2C55.776573%5D%2C%0A%5B-27.303581%2C55.776573%5D%2C%0A%5B-27.303581%2C-48.458352%5D%0A%5D%0A%5D%0A%7D"
```
=======
[![OSRD](assets/branding/osrd_small.svg)](https://github.com/DGEXSolutions/osrd)
[![public money, public code](assets/PMPC_badge.svg)](https://publiccode.eu/)

[![license](https://img.shields.io/badge/license-LGPL-blue.svg)](https://github.com/DGEXSolutions/osrd/blob/dev/LICENSE)
[![Integration](https://github.com/DGEXSolutions/osrd/actions/workflows/integration_tests.yml/badge.svg)](https://github.com/DGEXSolutions/osrd/actions/workflows/integration_tests.yml)
[![Core](https://github.com/DGEXSolutions/osrd/actions/workflows/core.yml/badge.svg)](https://github.com/DGEXSolutions/osrd/actions/workflows/core.yml)
[![API](https://github.com/DGEXSolutions/osrd/actions/workflows/api.yml/badge.svg)](https://github.com/DGEXSolutions/osrd/actions/workflows/api.yml)
[![Front](https://github.com/DGEXSolutions/osrd/actions/workflows/front.yml/badge.svg)](https://github.com/DGEXSolutions/osrd/actions/workflows/front.yml)
[![codecov](https://codecov.io/gh/DGEXSolutions/osrd/branch/dev/graph/badge.svg?token=O3NAHQ01NO)](https://codecov.io/gh/DGEXSolutions/osrd)

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

You'll need:
 - Docker
 - Docker Compose

```sh
docker-compose up
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

## Contact

You are interested in the project, and you want to know more? Contact us at <contact@osrd.fr>.
>>>>>>> 013414f501252df3fa2a43ab58523ee3361d2aef
