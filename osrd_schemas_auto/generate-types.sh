#!/usr/bin/env bash
# Generate Python types from openapi.yaml using datamodel-codegen

set -e
set -o pipefail

uv run datamodel-codegen \
    --input openapi.yaml \
    --input-file-type openapi \
    --openapi-scopes schemas paths \
    --use-standard-collections \
    --disable-timestamp \
    --use-union-operator \
    --use-field-description \
    --use-schema-description \
    --use-title-as-name \
    --collapse-root-models \
    --output-model-type pydantic_v2.BaseModel \
    --use-default \
    --set-default-enum-member \
    --enum-field-as-literal one \
    --use-annotated \
    --use-double-quotes
