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
