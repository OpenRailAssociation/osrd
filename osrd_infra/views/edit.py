from rest_framework.response import Response
from rest_framework.generics import get_object_or_404
from rest_framework.views import APIView
from rest_framework.exceptions import ParseError
from django.db import transaction

from osrd_infra.models import (
    Infra,
)


def status_missing_field_keyerror(key_error: KeyError):
    (key,) = key_error.args
    return {"type": "error", "message": f"missing field: {key}"}


def status_unknown_manifest_fields(manifest):
    return {
        "type": "error",
        "message": f"unknown manifest fields: {', '.join(manifest)}",
    }


def status_success():
    return {"type": "success"}


def status_placeholder():
    return {"type": "placeholder"}


def create_entity(namespace, manifest):
    try:
        entity_type = manifest.pop("entity_type")
        components = manifest.pop("components")
    except KeyError as e:
        return status_missing_field_keyerror(e)

    if manifest:
        return status_unknown_manifest_fields(manifest)

    print((entity_type, components))
    return status_success()


def delete_entity(namespace, manifest):
    return status_placeholder()


def add_component(namespace, manifest):
    return status_placeholder()


def update_component(namespace, manifest):
    return status_placeholder()


def delete_component(namespace, manifest):
    return status_placeholder()


EDITION_OPERATIONS = {
    "create_entity": create_entity,
    "delete_entity": delete_entity,
    "add_component": add_component,
    "update_component": update_component,
    "delete_component": delete_component,
}


class InfraEdition(APIView):
    @transaction.atomic
    def post(self, request, pk):
        infra = get_object_or_404(Infra, pk=pk)
        namespace = infra.namespace

        operations = request.data
        if not isinstance(operations, list):
            raise ParseError("expected a list of operations")

        result = []
        for i, manifest in enumerate(operations):
            if not isinstance(manifest, dict):
                raise ParseError(f"{i}th manifest isn't a dict")

            operation_id = manifest.pop("operation", None)
            if operation_id is None:
                raise ParseError(f"{i}th manifest doesn't have an operation field")

            operation = EDITION_OPERATIONS.get(operation_id)
            if operation is None:
                raise ParseError(f"unknown operation: {operation_id}")

            result.append(operation(namespace, manifest))

        return Response(result)
