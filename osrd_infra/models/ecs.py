from django.contrib.gis.db import models
from typing import List, Any, Type, Union, Mapping, Optional
from django.db.models.base import ModelBase
from django.contrib.contenttypes.models import ContentType
from dataclasses import dataclass


"""
Implements a basic Entity Component System
https://en.wikipedia.org/wiki/Entity_component_system
"""


class EntityNamespace(models.Model):
    """
    A group of entities.
    This enables having multiple ecs instances running at the same time.
    """

    pass


@dataclass(frozen=True)
class Arity:
    # included low bound
    low_bound: int
    # included high bound, or +infinity
    high_bound: Optional[int]

    @property
    def is_many(self):
        high_bound = self.high_bound
        if high_bound is None:
            return True
        if high_bound > 1:
            return True
        return False

    @staticmethod
    def parse(arity: Any) -> "Arity":
        if arity == "*" or arity is ...:
            return Arity(0, None)

        # single arity
        if isinstance(arity, int):
            assert arity > 0
            return Arity(arity, arity)

        # range arity
        if isinstance(arity, tuple):
            low_bound, high_bound = arity
            if low_bound is ...:
                low_bound = 0
            if high_bound is ...:
                high_bound = None
            assert low_bound != 0 or high_bound != 0
            return Arity(low_bound, high_bound)

        raise ValueError(f"invalid arity: {arity}")


@dataclass
class EntityMeta:
    name: str
    components: Mapping[Type["Component"], Arity]

    def __repr__(self):
        return f"<EntityMeta name={self.name}>"

    def component_names(self):
        return (component._component_meta.name for component in self.components)


# these attributes are forwarded from the entity declaration to the django Meta
PASSTHROUGH_ATTR_NAMES = (
    "verbose_name",
    "verbose_name_plural",
)


class EntityBase(ModelBase):
    def __new__(cls, class_name, bases, attrs, entity_base_passthrough=False, **kwargs):
        if entity_base_passthrough:
            return super().__new__(cls, class_name, bases, attrs, **kwargs)

        passthrough_attrs = {}
        for attr_name in PASSTHROUGH_ATTR_NAMES:
            attr = attrs.pop(attr_name, None)
            if attr is not None:
                passthrough_attrs[attr_name] = attr

        # parse all entity attributes
        entity_name = attrs.pop("name")
        components = attrs.pop("components")
        module = attrs.pop("__module__")
        qualname = attrs.pop("__qualname__")
        assert not attrs, "unknown entity attributes: {}".format(", ".join(attrs))

        # parse the list of available components for the entity
        parsed_components = {}
        for comp, arity in components.items():
            assert issubclass(
                comp, Component
            ), f"{comp} isn't a Component, and thus can't be part of {class_name}"
            parsed_components[comp] = Arity.parse(arity)

        # create a constructor which injects the entity_type value
        # that's the whole point of creating a proxy model in the first place:
        # to able to seamlessly work with the entities of a given type only,
        # creating new entities must assign the correct type
        def dj_init(self, *args, **kwargs):
            assert "entity_type" not in kwargs
            kwargs["entity_type"] = ContentType.objects.get_for_model(
                entity_type, for_concrete_model=False
            )
            super(entity_type, self).__init__(*args, **kwargs)

        # create the manager, but don't fill the entity_type field yet:
        # the model isn't yet created
        entity_manager = EntityManager()

        # build the django model
        dj_bases = (Entity,)
        dj_attrs = {
            "objects": entity_manager,
            "Meta": type("Meta", (), {**passthrough_attrs, "proxy": True}),
            "__init__": dj_init,
            "__module__": module,
            "__qualname__": qualname,
            "_entity_meta": EntityMeta(entity_name, parsed_components),
        }

        # this local variable is used by the dj_init closure above
        entity_type = super().__new__(cls, class_name, dj_bases, dj_attrs, **kwargs)
        return entity_type


class Entity(models.Model, metaclass=EntityBase, entity_base_passthrough=True):
    """Each instance is an object in the infrastructure"""

    entity_id = models.BigAutoField(primary_key=True)

    namespace = models.ForeignKey(EntityNamespace, on_delete=models.CASCADE)

    entity_type = models.ForeignKey(
        ContentType, on_delete=models.CASCADE, editable=False
    )

    def __str__(self):
        return f"Entity(entity_id={self.entity_id}, entity_type={self.entity_type})"


class EntityManager(models.Manager):
    """A manager which only lists entities of a given type"""

    def get_queryset(self):
        entity_type = ContentType.objects.get_for_model(
            self.model, for_concrete_model=False
        )
        return super().get_queryset().filter(entity_type=entity_type)


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
            assert (
                component_name is not None
            ), f"{name}'s Meta is missing a component_name"
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


class UniqueComponent(Component):
    class Meta:
        abstract = True
        constraints = [
            models.UniqueConstraint(
                fields=["entity"], name="%(app_label)s_unique_%(class)s"
            )
        ]
