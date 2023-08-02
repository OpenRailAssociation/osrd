# RAILJSON GENERATOR

## How to use

### Infra Builder

- `__init__(self) -> InfraBuilder`: Instantiates an infra builder.
- `add_track_section(self, length, label="track.X", waypoints=[], signals=[], operational_points=[]) -> TrackSection`: Add a track section.
- `add_point_switch(self, base, left, right, label="switch.X", delay=0, signal_on_ports={"port": ("detector_label", "signal_label")}) -> Switch`: Add a point.
- `add_cross_switch(self, north, south, east, west, label="switch.X", delay=0, signal_on_ports={"port": ("detector_label", "signal_label")) -> Switch`: Add a cross switch.
- `add_double_cross_switch(self, north_1, north_2, south_1, south_2, label="switch.X", delay=0, signal_on_ports={"port": ("detector_label", "signal_label")) -> Switch`: Add a double cross switch.
- `add_link(self, begin, end, navigability=ApplicableDirection.BOTH) -> Link`: Add a link.
- `add_operational_point(self, label) -> OperationPoint`: Add an operation point.
- `build(self) -> Infra`: Build an infra, generating tvd sections, routes and missing bufferstops.

### Track Section

- `add_detector(self, position, label="detector.X", applicable_direction=ApplicableDirection.BOTH) -> Detector`: Add a detector.
- `add_buffer_stop(self, position, label="buffer_stop.X") -> BufferStop`: Add a buffer_stop.
- `add_signal(self, position, applicable_direction, linked_detector, label="signal.X", sight_distance=400) -> Signal`: Add a signal. Simulation won't work unless logical signals are added to the signal.
- `set_remaining_coords(self, [[x1, y1], [x2, y2], [x3, y3]])`: Sets the geometry coordinates for the track section. Sets values for extremities if none was already set, else only set values between extremities.

### Signal

- `add_logical_signal(self, signaling_system: str, next_signaling_systems: List[str], settings: List[str]) -> LogicalSignal`: Add a logical signal to a signal.

### Switch / Link / TrackEndpoint

- `set_coords(self, x, y)`: Set a geometry coordinates of the point

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

You can find a complete example [here](./railjson_generator/scripts/examples/example_script.py).

## Run the generation script

In order to run a generation script, you must place it inside [the script directory](./railjson_generator/scripts), and then run [generate.py](./railjson_generator/generate.py) by passing it two arguments:

- The output folder where to write the railjson and the simulation json.
- The name of the script (without the extension nor the parent directory) that you want to run.
