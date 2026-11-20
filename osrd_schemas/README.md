# osrd_schemas

Pydantic models generated from the [Railway manager interface](../railway_manager_interface/) OpenAPI specification.

## Python models

`osrd_schemas/models.py` holds Pydantic models built from `../railway_manager_interface/openapi.yaml`. The file is generated. Do not edit it by hand.

## Code generation

`models.py` is generated from `../railway_manager_interface/openapi.yaml` and must be kept in sync with it. Run these commands from this directory:

```bash
just install
./generate-types.sh > osrd_schemas/models.py
```

Alternatively, this step is included as part of:

```bash
scripts/sync-openapi.sh
```

CI fails if `models.py` is out of date.

## Versioning

Any change performed to osrd-schemas published code, whether auto-generated or manually written, should correspond to a version change in `pyproject.toml`. Breaking changes should correspond to at least a minor version increase.

To easily perform this task while keeping osrd projects depending on osrd_schemas synced, a script is provided:

```bash
scripts/bump-osrd-schemas-version.sh [-p/--patch] [-m/--minor] [-M/--major] [-h/--help]
```

By default this script performs a minor version bump.
