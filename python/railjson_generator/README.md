# RAILJSON GENERATOR

Use poetry to install dependencies:

```sh
poetry install
```

## Running generation scripts

To run a generation script, pass its output directory as its first argument:

```sh
mkdir small_infra_out
poetry run scripts/small_infra.py small_infra_out
```

This library provides an helper to generate multiple infrastructures at once:

```sh
poetry run python3 -m railjson_generator /tmp/all_infras scripts/*.py
```

## API

### Infra Builder

- `__init__(self) -> InfraBuilder`: Instantiates an infra builder.
- `add_track_section(self, length, label="track.X", waypoints=[], signals=[], operational_points=[]) -> TrackSection`: Add a track section.
- `add_point_switch(self, base, left, right, label="track_node.X", delay=0) -> TrackNode`: Add a point switch.
- `add_crossing(self, north, south, east, west, label="track_node.X", delay=0) -> TrackNode`: Add a crossing.
- `add_double_slip_switch(self, north_1, north_2, south_1, south_2, label="track_node.X", delay=0) -> TrackNode`: Add a double cross slip switch.
- `add_link(self, source, destination) -> TrackNode`: Add a link.
- `add_operational_point(self, label) -> OperationPoint`: Add an operation point.
- `generate_routes(self, progressive_release=True) -> Iterable[Route]`: Automatically generate routes, which must then be registered manually. When progressive_release is true, release points are added for all intermediate zones.
- `register_route(self, route: Route)`: Register a route
- `build(self, progressive_release=True) -> Infra`: Build an infra, generating tvd sections, routes and missing bufferstops.

### Track Section

- `add_detector(self, position, label="detector.X", applicable_direction=ApplicableDirection.BOTH) -> Detector`: Add a detector.
- `add_buffer_stop(self, position, label="buffer_stop.X") -> BufferStop`: Add a buffer_stop.
- `add_signal(self, position, applicable_direction, is_route_delimiter, label="signal.X", sight_distance=400) -> Signal`: Add a signal. Simulation won't work unless logical signals are added to the signal. `is_route_delimiter` controls whether routes should stop at this signal.
- `set_remaining_coords(self, [(x1, y1), (x2, y2), (x3, y3)])`: Sets the geometry coordinates for the track section. Sets values for extremities if none was already set, else only set values between extremities.

### Signal

- `add_logical_signal(self, signaling_system: str, next_signaling_systems: List[str], settings: List[str]) -> LogicalSignal`: Add a logical signal to a signal.

### TrackNode / TrackEndpoint

- `set_coords(self, x, y)`: Set a geometry coordinates of the point

### Route

Route can either be manually created, or generated using `generate_routes`, and filtered to excluded unwanted paths.

- `waypoints: List[Waypoint]`
- `release_waypoints: List[Waypoint]`
- `entry_point_direction: Direction`
- `track_nodes_directions: Mapping[str, str]`
- `label: str`
- `entry_point: Waypoint` is a getter for `waypoints[0]`
- `exit_point: Waypoint` is a getter for `waypoints[-1]`

### Operation point

- `add_part(self, track, offset)`: Link an operational point to a position.

### Infra

- `save(self, path)`: Format to railjson and save at the given location.

### Simulation Builder

- `__init__(self) -> SimulationBuilder`: Instantiates a simulation builder.
- `add_train_schedule(self, *locations, label="train.X", rolling_stock="fast_rolling_stock", departure_time=0, initial_speed=0, stops=[]) -> TrainSchedule`: Add a new train schedule, generate path given positions.
- `build(self) -> Simulation`: Build the simulation configuration.

### Train Schedule

- `add_stop(self, duration, location=None, position=None) -> Stop`: Add a stop, only one of the attributes 'location' or 'position' must be defined.

### Simulation

- `save(self, path)`: Format to railjson and save at the given location.

## Example

You can find a complete example here: [small_infra.py](railjson_generator/schema/infra/infra.py).

## Testing

```sh
poetry run pytest
```

## Linting

Use pflake8 and pytype to check for style issues and potential errors.

```sh
$ poetry run pflake8 --config ./pyproject.toml
$ poetry run pytype -j auto
```

Use black and isort to fix formatting.

```sh
$ poetry run black .
$ poetry run isort .
```
