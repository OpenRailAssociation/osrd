# OSRD's Schemas

This python library holds schemas definition used by both API and the RailJson Generator.

## Node Types

Some node types (named primitives) are defined in the code of services:
- In core we find them in `RJSSwitchType.java`.
- In editoast they are found in `src/schema/switch_type.rs`.
- In the osrd_schema, we find them in `osrd_schemas/switch_type.py`.

To add a primitive to the existing switch_types, you need to modify these 3 files and add the corresponding functions to add a switch of this type if necessary.

## Getting Started

If you want to contribute to this service you need:

- [`uv`](https://docs.astral.sh/uv/).

## Utils

A script exists to help extracting a subset of an infrastructure, based of a GeoJSON boundary.
You can use it the following way.

```
❯ uv run scripts/truncate_infra.py ../../tests/data/infras/small_infra/infra.json infra.json "[
    [ -0.14969977501792187, 49.543586012039040 ],
    [ -0.39177237871587070, 49.483236027590976 ],
    [ -0.39779075836571565, 49.454119867540670 ],
    [ -0.18982230601724837, 49.461509188307474 ],
    [ -0.14969977501792187, 49.543586012039040 ]
]"
```
