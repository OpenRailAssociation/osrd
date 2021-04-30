import inspect
from django.contrib import admin
from django.contrib.admin import ModelAdmin
from typing import Type
import osrd_infra.models
from osrd_infra.models import (
    # ecs
    Entity,
    Component,
    get_entity_meta,
    get_component_meta,
    EntityNamespace,
    # misc
    Infra,
    IdentifierDatabase,
)


def generate_inline(component: Type[Component]):
    component_meta = get_component_meta(component)
    attrs = {"model": component, "extra": 1}
    if component_meta.unique:
        attrs["max_num"] = 1
    return type(component.__name__ + "GeneratedInline", (admin.TabularInline,), attrs)


def generate_inlines(model: Type[Entity]):
    return tuple(
        generate_inline(component)
        for component in get_entity_meta(model).components
    )


def generate_entity_admin(model: Type[Entity]):
    attrs = {"inlines": generate_inlines(model)}
    return type(model.__name__ + "GeneratedAdmin", (ModelAdmin,), attrs)


for attr_name, attr in inspect.getmembers(osrd_infra.models):
    if not hasattr(attr, "_entity_meta"):
        continue
    entity_admin = generate_entity_admin(attr)
    admin.register(attr)(entity_admin)


admin.site.register(
    [
        # ecs
        EntityNamespace,
        # misc
        Infra,
        IdentifierDatabase,
    ]
)
