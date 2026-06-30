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

CI fails if `models.py` is out of date.
