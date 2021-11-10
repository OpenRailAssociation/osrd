# RAILJSON GENERATOR

## How to use

### Infra Builder

- `__init__(self) -> InfraBuilder`: Instantiates an infra builder.
- `add_track_section(self, length, label="track.X", waypoints=[], signals=[], operational_points=[]) -> TrackSection`: Add a track section.
- `add_switch(self, base, left, right, label="switch.X", delay=0) -> Switch`: Add a switch.
- `add_link(self, begin, end, navigability=ApplicableDirection.BOTH) -> Link`: Add a link.
- `add_operational_point(self, label) -> OperationPoint`: Add an operation point.
- `build(self) -> Infra`: Build an infra, generating tvd sections, routes and missing bufferstops.

### Track Section

- `add_detector(self, position, label="detector.X", applicable_direction=ApplicableDirection.BOTH) -> Detector`: Add a detector.
- `add_buffer_stop(self, position, label="buffer_stop.X", applicable_direction=ApplicableDirection.BOTH) -> BufferStop`: Add a buffer_stop.
- `add_signal(self, position, applicable_direction, linked_detector, label="signal.X", sight_distance=400) -> Signal`: Add a signal.

### Switch / Link / TrackEndpoint 

- `set_coords(self, x, y)`: Set a geometry coordinates of the point

### Operation point 

- `set_position(self, track, offset)`: Link an operational point to a position.

### Infra 

- `save(self, path)`: Format to railjson and save at the given location.

### Simulation Builder

- `__init__(self, infra) -> SimulationBuilder`: Instantiates a simulation builder.
- `add_train_schedule(self, *locations, label="train.X", rolling_stock="fast_rolling_stock", departure_time=0, initial_speed=0, stops=[]) -> TrainSchedule`: Add a new train schedule, generate path given positions.
- `add_tst(self, switch, *train_order) -> TST`: Set a train order for the given switch.
- `build(self) -> Simulation`: Build the simulation configuration.

### Train Schedule

- `add_stop(self, duration, location=None, position=None) -> Stop`: Add a stop, only one of the attributes 'location' or 'position' must be defined.

### Simulation 

- `save(self, path)`: Format to railjson and save at the given location.

## Example

You can find a complete example [here](gen_example.py).