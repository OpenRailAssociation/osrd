from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction, IntegrityError
from osrd_infra.serializers import ComponentSerializer
from rest_framework.exceptions import ParseError, APIException
from rest_framework.response import Response


from osrd_infra.models import (
    # ecs
    Entity,
    get_component_meta,
    get_entity_meta,
    ALL_COMPONENT_TYPES,
    ALL_ENTITY_TYPES,
)


class IntegrityException(APIException):
    status_code = 400
    default_detail = "Database integrity exception"
    default_code = "bad_request"


def status_missing_field_keyerror(key_error: KeyError):
    (key,) = key_error.args
    raise ParseError(f"missing field: {key}")


def status_unknown_manifest_fields(manifest):
    raise ParseError(f"unknown manifest fields: {', '.join(manifest)}")


def get_entity_type(entity_name):
    entity_type = ALL_ENTITY_TYPES.get(entity_name)
    if entity_type is None:
        raise ParseError(f"unknown entity type: {entity_name}")
    return entity_type


def try_extract_field(manifest, field):
    try:
        return manifest.pop(field)
    except KeyError as e:
        return status_missing_field_keyerror(e)


def try_save_component(component, **kwargs):
    try:
        return component.save(**kwargs)
    except IntegrityError as e:
        raise IntegrityException(e)


def get_entity(entity_id):
    try:
        return Entity.objects.get(pk=entity_id)
    except ObjectDoesNotExist:
        raise IntegrityException(f"Entity with id '{entity_id}' doesn't exist")
    except (TypeError, ValueError):
        data_type = type(entity_id).__name__
        raise ParseError(f"Incorrect type. Expected 'int', got '{data_type}'.")


def get_component(component_type, component_id):
    try:
        return component_type.objects.get(pk=component_id)
    except ObjectDoesNotExist:
        raise IntegrityException(
            f"Component '{component_type._component_meta.name}' with id '{component_id}' doesn't exist"
        )
    except (TypeError, ValueError):
        data_type = type(component_id).__name__
        raise ParseError(f"Incorrect type. Expected 'int', got '{data_type}'.")


def get_component_type(component_type_name):
    component_type = ALL_COMPONENT_TYPES.get(component_type_name)
    if component_type is None:
        raise ParseError(f"'Invalid component type '{component_type_name}'")
    return component_type


# Editions operations


def create_entity(namespace, manifest):
    entity_type_name = try_extract_field(manifest, "entity_type")
    components = try_extract_field(manifest, "components")
    if manifest:
        return status_unknown_manifest_fields(manifest)

    entity_type = get_entity_type(entity_type_name)

    allowed_components = {}
    for component in get_entity_meta(entity_type).components:
        component_name = get_component_meta(component).name
        allowed_components[component_name] = component

    deserialized_components = []
    for component in components:
        # Get component type
        component_type_name = try_extract_field(component, "component_type")
        component_type = allowed_components.get(component_type_name)
        if component_type is None:
            raise ParseError(
                f"'{entity_type_name}' has no '{component_type_name}' component'"
            )

        # Deserialize component payload
        component_payload = try_extract_field(component, "component")
        serializer = ComponentSerializer.registry[component_type]
        assert serializer is not None
        deserialized = serializer(data=component_payload, omit_entity_id=True)
        deserialized.is_valid(raise_exception=True)
        deserialized_components.append(deserialized)

    # Create entity
    entity = entity_type(namespace_id=namespace.id)
    entity.save()

    # Create components
    component_ids = []
    for component in deserialized_components:
        component_ids.append(
            try_save_component(component, entity_id=entity.entity_id).component_id
        )

    return {
        "type": "success",
        "entity_id": entity.entity_id,
        "component_ids": component_ids,
    }


def delete_entity(namespace, manifest):
    entity_id = try_extract_field(manifest, "entity_id")
    if manifest:
        return status_unknown_manifest_fields(manifest)

    entity = get_entity(entity_id)
    entity.delete()
    return {"type": "success"}


def add_component(namespace, manifest):
    entity_id = try_extract_field(manifest, "entity_id")
    component_type_name = try_extract_field(manifest, "component_type")
    component_payload = try_extract_field(manifest, "component")
    if manifest:
        return status_unknown_manifest_fields(manifest)

    entity = get_entity(entity_id)
    entity_type = entity.get_concrete_type()

    allowed_components = {}
    for component in get_entity_meta(entity_type).components:
        component_name = get_component_meta(component).name
        allowed_components[component_name] = component

    # Get component type
    component_type = allowed_components.get(component_type_name)
    if component_type is None:
        raise ParseError(
            f"'Entity '{entity_id}' has no '{component_type_name}' component'"
        )

    # Deserialize component payload
    serializer = ComponentSerializer.registry[component_type]
    assert serializer is not None
    deserialized = serializer(data=component_payload, omit_entity_id=True)
    deserialized.is_valid(raise_exception=True)

    # Create component
    component = try_save_component(deserialized, entity_id=entity_id)

    return {"type": "success", "component_id": component.component_id}


def update_component(namespace, manifest):
    component_id = try_extract_field(manifest, "component_id")
    component_type_name = try_extract_field(manifest, "component_type")
    component_payload = try_extract_field(manifest, "update")
    if manifest:
        return status_unknown_manifest_fields(manifest)

    # Get component
    component_type = get_component_type(component_type_name)
    component = get_component(component_type, component_id)

    # Deserialize component payload update
    serializer = ComponentSerializer.registry[component_type]
    assert serializer is not None
    deserialized = serializer(component, data=component_payload, partial=True)
    deserialized.is_valid(raise_exception=True)

    # Update component
    try_save_component(deserialized)

    return {"type": "success"}


def delete_component(namespace, manifest):
    component_id = try_extract_field(manifest, "component_id")
    component_type_name = try_extract_field(manifest, "component_type")
    if manifest:
        return status_unknown_manifest_fields(manifest)

    # Get component
    component_type = get_component_type(component_type_name)
    component = get_component(component_type, component_id)

    # Delete component
    component.delete()

    return {"type": "success"}


EDITION_OPERATIONS = {
    "create_entity": create_entity,
    "delete_entity": delete_entity,
    "add_component": add_component,
    "update_component": update_component,
    "delete_component": delete_component,
}


@transaction.atomic
def edit_infra(infra, operations):
    namespace = infra.namespace

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
