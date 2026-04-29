import sys
from typing import Any, Iterable, Mapping, MutableMapping, Set

import yaml
from openapi_pydantic import Components, OpenAPI, Reference, Schema
from pydantic import BaseModel, ValidationError


def load_yaml_file(file_path: str) -> dict:
    """Load a YAML file with UTF-8 encoding and return a raw dictionary."""
    with open(file_path, "r", encoding="utf-8") as f:
        return yaml.load(f, Loader=yaml.BaseLoader)


def load_openapi_model(file_path: str) -> OpenAPI:
    """Load an OpenAPI file using openapi-pydantic."""
    raw_data = load_yaml_file(file_path)
    return OpenAPI.model_validate(raw_data)


def model_dump(model: BaseModel) -> MutableMapping[str, Any]:
    """Return a clean dictionary from a Pydantic compatible V1/V2 model."""
    if hasattr(model, "model_dump"):
        # Use mode='json' to ensure all objects are converted to JSON-serializable types
        # This handles complex Pydantic types like DataType that aren't directly YAML-serializable
        return model.model_dump(by_alias=True, exclude_none=True, mode="json")
    return model.dict(by_alias=True, exclude_none=True)


def find_referenced_schemas(obj: Any, external_only: bool = False) -> Set[str]:
    """Find all referenced schemas in an OpenAPI object using openapi-schema-pydantic."""

    def _parse_with_model(model_cls, data: Any):
        if hasattr(model_cls, "model_validate"):
            return model_cls.model_validate(data)
        return model_cls.parse_obj(data)

    def _model_dump(model: BaseModel) -> dict:
        if hasattr(model, "model_dump"):
            return model.model_dump(exclude_none=True)
        return model.dict(exclude_none=True)

    def _iter_values(container: Any) -> Iterable[Any]:
        if isinstance(container, dict):
            return container.values()
        if isinstance(container, (list, tuple, set)):
            return container
        return ()

    def _handle_ref(ref: str, acc: Set[str]) -> None:
        if external_only:
            prefix = "../editoast/openapi.yaml#/components/schemas/"
        else:
            prefix = "#/components/schemas/"
        if ref.startswith(prefix):
            acc.add(ref.split("/")[-1])

    def _walk(value: Any, acc: Set[str]) -> None:
        if isinstance(value, Reference):
            _handle_ref(value.ref, acc)
            return
        if isinstance(value, BaseModel):
            for nested in _model_dump(value).values():
                _walk(nested, acc)
            return
        if isinstance(value, str):
            _handle_ref(value, acc)
            return
        for nested in _iter_values(value):
            _walk(nested, acc)

    referenced_schemas: Set[str] = set()

    parsed_model = None
    if isinstance(obj, BaseModel):
        parsed_model = obj
    elif isinstance(obj, dict):
        for candidate in (OpenAPI, Schema):
            try:
                parsed_model = _parse_with_model(candidate, obj)
                break
            except ValidationError:
                continue

    if parsed_model is not None:
        _walk(parsed_model, referenced_schemas)
    else:
        _walk(obj, referenced_schemas)

    return referenced_schemas


def find_transitive_schemas(
    schemas: Mapping[str, Schema | Reference], initial_schemas: Set[str]
) -> Set[str]:
    all_schemas = set(initial_schemas)
    to_process = list(initial_schemas)

    while to_process:
        current_schema = to_process.pop(0)
        if current_schema in schemas:
            # Find the internal references in this schema
            schema_refs = find_referenced_schemas(
                schemas[current_schema], external_only=False
            )
            for ref in schema_refs:
                if ref not in all_schemas:
                    all_schemas.add(ref)
                    to_process.append(ref)

    return all_schemas


def extract_required_schemas() -> dict[str, Schema | Reference]:
    """Extract the required schemas dynamically by analyzing the references using openapi-schema-pydantic."""
    print("Reading the openapi.yaml file...", file=sys.stderr)
    root_api_model = load_openapi_model("openapi.yaml")

    print("Analyzing the references to find the required schemas...", file=sys.stderr)
    initial_schemas = find_referenced_schemas(root_api_model, external_only=True)

    print(f"Directly referenced schemas: {len(initial_schemas)}", file=sys.stderr)
    for schema in sorted(initial_schemas):
        print(f"  • {schema}", file=sys.stderr)

    print("\n Reading the editoast openapi.yaml file...", file=sys.stderr)
    editoast_api_model = load_openapi_model("../editoast/openapi.yaml")
    schemas: dict[str, Schema | Reference] = {}
    if editoast_api_model.components and editoast_api_model.components.schemas:
        schemas = editoast_api_model.components.schemas

    print("Searching for transitive dependencies...", file=sys.stderr)
    all_required_schemas = find_transitive_schemas(schemas, initial_schemas)

    print(
        f"Total required schemas (with dependencies): {len(all_required_schemas)}",
        file=sys.stderr,
    )
    for schema in sorted(all_required_schemas):
        print(f"  • {schema}", file=sys.stderr)

    print("\n Extracting the schemas...", file=sys.stderr)
    extracted_schemas = {}
    for schema_name in all_required_schemas:
        if schema_name in schemas:
            extracted_schemas[schema_name] = schemas[schema_name]
            print(f"  ✓ {schema_name}", file=sys.stderr)
        else:
            print(
                f"  ✗ {schema_name} (missing in editoast openapi.yaml)", file=sys.stderr
            )

    return extracted_schemas


def create_temp_openapi() -> MutableMapping[str, Any]:
    """Create the enriched OpenAPI description."""
    print("Extracting the required schemas...", file=sys.stderr)
    extracted_schemas = extract_required_schemas()
    print("Reading the openapi.yaml file...", file=sys.stderr)
    root_api_model = load_openapi_model("openapi.yaml")
    temp_api_model = root_api_model.model_copy(deep=True)

    if temp_api_model.components is None:
        temp_api_model.components = Components()
    if temp_api_model.components.schemas is None:
        temp_api_model.components.schemas = {}

    temp_api_model.components.schemas.update(extracted_schemas)

    temp_api = model_dump(temp_api_model)

    # Update the references to point to the local schemas
    # Also remove format: duration to prevent datamodel-codegen from converting to timedelta
    def update_refs(obj):
        if isinstance(obj, dict):
            if "$ref" in obj and obj["$ref"].startswith("../editoast/openapi.yaml#"):
                # Replace the external reference by a local reference
                ref_path = obj["$ref"].split("#/components/schemas/")[-1]
                obj["$ref"] = f"#/components/schemas/{ref_path}"
            for value in obj.values():
                update_refs(value)
        elif isinstance(obj, list):
            for item in obj:
                update_refs(item)

    update_refs(temp_api)

    return temp_api


def main():
    temp_api = create_temp_openapi()
    yaml.dump(
        temp_api,
        sys.stdout,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
        Dumper=yaml.SafeDumper,
    )


if __name__ == "__main__":
    main()
