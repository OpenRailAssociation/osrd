# ui-charts

`ui-charts` is a library of charts and diagrams, designed by the project OSRD.

## Installation

To install the `ui-charts` package, run the following command in your project directory:

```sh
npm install @osrd-project/ui-charts
```

## Space Time Chart

The `SpaceTimeChart` is a React component designed to visualize train paths on a spacetime chart,
where the default horizontal axis (Ox) represents time and the default vertical axis (Oy) represents
space (axis can be swapped).

Paths, graduations and labels are rendered on **canvas elements**. For interaction detection, shapes
are rendered on a separate layer with unique colors using a technique known as **"picking"**.

`SpaceTimeChart` is solely responsible for rendering and does not manage any state internally. All
state management, including paths, offsets, scales, and zoom levels, must be handled by the parent
component.

You can have a look at its stories
[here](https://ui.osrd.fr/?path=/story/spacetimechart-rendering--default-args)
or
[here](https://ui.osrd.fr/?path=/story/manchette-with-spacetimechart-rendering--waypoint-menu)
with its manchette.

## Speed Space Chart

The `SpeedSpaceChart` is a React component designed to visualize the speed profile of a train along
a path. It also allow to visualize some data along the path, such as the electrical profiles, the
max speed profile, the power restrictions, etc.

You can have a look at its stories
[here](https://ui.osrd.fr/?path=/story/trackoccupancydiagram-rendering--track-occupancy-diagram-story-default).

## Track Occupancy Diagram

The `TrackOccupancyDiagram` is a React component designed to visualize the track occupancy in
station.

You can have a look at its story
[here](https://ui.osrd.fr/?path=/story/trackoccupancydiagram-rendering--track-occupancy-diagram-story-default).

## Resources

There are multiple places to get information on how to do things with `ui-charts`:

- **Storybook Integration**: Discover a variety of usage scenarios and configurations in the
  Storybook stories located in `src/stories` for each chart or diagram.
- **Unit Tests**: Refer to `src/__tests__` for practical demonstrations of helper functions from the
  `src/utils` folder.

## Contributing

Contributions are welcome! Please refer to the repository's main README.md and CODE_OF_CONDUCT.md
for more details on how to contribute.

## License

This project is licensed under the GNU LESSER GENERAL PUBLIC LICENSE Version 3, 29 June 2007 - see
the LICENSE file for details.
