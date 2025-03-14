# ui-spacetimechart

`ui-spacetimechart` is a React component designed to visualize train paths on a spacetime chart,
where the horizontal axis (Ox) represents time and the vertical axis (Oy) represents space.

Paths, graduations and labels are rendered on **canvas elements**. For interaction detection, shapes
are rendered on a separate layer with unique colors using a technique known as **"picking"**.

`ui-spacetimechart` is solely responsible for rendering and does not manage any state internally.
All state management, including paths, offsets, scales, and zoom levels, must be handled by the
parent component.

## Resources

There are multiple places to get information on how to do things with `ui-spacetimechart`:

- **Storybook Integration**: Discover a variety of usage scenarios and configurations in the
  Storybook stories located in `src/stories`.
- **Items Rendering**: Consult `src/components/PathLayer.tsx` for examples on rendering interactive
  items.
- **Unit Tests**: Refer to `src/__tests__` for practical demonstrations of helper functions from the
  `src/utils` folder.
