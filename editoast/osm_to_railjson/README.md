# Converter from OSM to raijson

## Usage

Example for Germany:

1. Download OSM's German data (~4Gb `germany-latest.osm.pbf`) from
    https://download.geofabrik.de/europe/germany.html

    This is not mandatory, but we strongly recommend using [osmium](https://osmcode.org/osmium-tool/) to filter the osm.pbf file with only the data needed by osm_to_railjson.
    ```sh
    osmium tags-filter <path/to/germany-latest.osm.pbf> nwr/railway r/public_transport=stop_area -o <path/to/germany-latest.osm.pbf>
    ```
    It can divide by 3 the time taken by osm_to_railjson.
2. Launch conversion (release build of editoast and conversion can be long):
    ```sh
    cd ../../editoast
    cargo run --release -p osm_to_railjson -- <path/to/germany-latest.osm.pbf> <path/to/germany_railjson.json>
    ```
	Use ```--generate-signals``` to automatically generate realistics signals.
3. Load railjson (also possible through [a script](../../scripts/load-railjson-infra.sh) or OSRD's web interface):
    ```sh
    cargo run --release -- infra import-railjson --generate "Germany" <path/to/germany_railjson.json>
    ```
