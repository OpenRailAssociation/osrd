# Converter from OSM to raijson

## Usage

Example for Germany:

1. Download OSM's German data (~4Gb `germany-latest.osm.pbf`) from
    https://download.geofabrik.de/europe/germany.html
2. Launch conversion (release build of editoast and conversion can be long):
    ```sh
    cd ../../editoast
    cargo run --release -- osm-to-railjson <path/to/germany-latest.osm.pbf> <path/to/germany_railjson.json>
    ```
3. Load railjson (also possible through [a script](../../scripts/load-railjson-infra.sh) or OSRD's web interface):
    ```sh
    cargo run --release -- infra import-railjson --generate "Germany" <path/to/germany_railjson.json>
    ```
