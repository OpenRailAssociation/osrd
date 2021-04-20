from django.contrib.gis.db import models
from typing import List, Any, Type, Union, Mapping
from django.db.models.base import ModelBase
from dataclasses import dataclass


"""
Implements a basic Entity Component System
https://en.wikipedia.org/wiki/Entity_component_system
"""


class EntityMeta:
    __slots__ = ("name", "components")

    def __init__(self, name, components):
        self.name = name
        self.components = components

    def __repr__(self):
        return f"<EntityMeta name={self.name}>"


class EntityBase(ModelBase):
    def __new__(cls, class_name, bases, attrs, entity_base_passthrough=False, **kwargs):
        if entity_base_passthrough:
            return super().__new__(cls, class_name, bases, attrs, **kwargs)

        # parse all entity attributes
        entity_name = attrs.pop("name")
        type_id = attrs.pop("type_id")
        components = attrs.pop("components")
        module = attrs.pop("__module__")
        qualname = attrs.pop("__qualname__")
        assert not attrs, "unknown entity attributes: {}".format(", ".join(attrs))

        def _save(self, *args, **kwargs):
            self.type_id = type_id
            return Entity.save(self, *args, **kwargs)

        dj_attrs = {
            "objects": EntityManager(type_id),
            "save": _save,
            "Meta": type("Meta", (), {"proxy": True}),
            "__module__": module,
            "__qualname__": qualname,
            "_entity_meta": EntityMeta(entity_name, components),
        }
        dj_bases = (Entity,)

        return super().__new__(cls, class_name, dj_bases, dj_attrs, **kwargs)


class Entity(models.Model, metaclass=EntityBase, entity_base_passthrough=True):
    """Each instance is an object in the infrastructure"""

    entity_id = models.BigAutoField(primary_key=True)

    class Type(models.IntegerChoices):
        TRACK_SECTION = 0
        TRACK_SECTION_LINK = 1
        SIGNAL = 2
        OPERATIONAL_POINT = 3
        SWITCH = 4

    # TODO: switch to a more flexible foreign key to an EntityType instance
    type_id = models.IntegerField(choices=Type.choices, db_index=True, editable=False)

    def type_repr(self):
        return self.Type.names[self.type_id]

    def __str__(self):
        return f"Entity(id={self.entity_id}, type_id={self.type_repr()})"


class EntityManager(models.Manager):
    """A manager which only lists entities of a given type"""

    __slots__ = ("type_id",)

    def __init__(self, type_id: Entity.Type):
        self.type_id = type_id
        super().__init__()

    def get_queryset(self):
        return super().get_queryset().filter(type_id=self.type_id)


class ComponentMeta:
    """Holds all component type specific metadata"""

    __slots__ = ("name",)

    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"<ComponentMeta name={self.name}>"


class ComponentBase(ModelBase):
    """
    This metaclass preprocesses component classes before passing them on to django.
    It adds a component_meta attribute to the class, and setups a sane default related_name
    from the component name.
    """

    def __new__(cls, name, bases, attrs):
        meta = attrs.get("Meta", None)
        assert meta is not None, "Component is missing its Meta attribute"

        is_abstract = getattr(meta, "abstract", False)
        if not is_abstract:
            # extract component_specific meta
            component_name = getattr(meta, "component_name", None)
            assert component_name is not None, f"{name}'s Meta is missing a component_name"
            del meta.component_name

            attrs["_component_meta"] = ComponentMeta(component_name)

            # synthesize relevant django meta
            if getattr(meta, "default_related_name", None) is None:
                meta.default_related_name = component_name

        # call the django metaclass
        clsobj = super().__new__(cls, name, bases, attrs)
        assert getattr(clsobj, "_meta", None) is not None
        return clsobj


class Component(models.Model, metaclass=ComponentBase):
    component_id = models.BigAutoField(primary_key=True)
    entity = models.ForeignKey("Entity", on_delete=models.CASCADE, db_index=True)

    class Meta:
        abstract = True


class UniqueComponent(models.Model, metaclass=ComponentBase):
    component_id = models.BigAutoField(primary_key=True)
    entity = models.OneToOneField("Entity", on_delete=models.CASCADE, db_index=True)

    class Meta:
        abstract = True
        constraints = [
            models.UniqueConstraint(
                fields=["entity"], name="%(app_label)s_unique_%(class)s"
            )
        ]
