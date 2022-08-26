# OSM INFRA

## What is OSM ?

### OpenStreetMap

See the [OpenStreetMap website](https://www.openstreetmap.org) as well as the official [documentation](https://wiki.openstreetmap.org/wiki/Main_Page)
This script uses the OSM API to import data about railway infrastructure and generate an infrastructure readable by the osrd software

## How to use

### Generate the infra

- Run the generation script as described [here](../../README.md)
- Run osrd (see [here](../../../../../README.md) for more info)
- Import the infra into osrd using the commands [here](../../../../../scripts/load-generated-infra.sh)

### Generate other infrastructures

- You can change the generated infra by changing the [script](../osm_infra.py):
    - Choose any OSM relation id (or multiple ids) corresponding to a railway network
    - Change NetworkGraph.from_multiple_relations_ids(*ids).to_railjson() in the [script](../osm_infra.py) to fit the ids you want to use
    - Run the generation script