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

## Running osrd on workspace

### Installation

**Please install it at the root of your home**, to do so run the following:
```shell
cd ${HOME}
git clone https://gitlab.com/osrdata/services/osrd
cd osrd
./init_workspace.sh
```

### Usage

To launch osrd go to `Run` >> `Run Configurations` >> `osrd`, then click to `Run` (with the green play button).
