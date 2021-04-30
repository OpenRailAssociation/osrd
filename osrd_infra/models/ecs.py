from django.contrib.gis.db import models
from typing import List, Type
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


@dataclass
class EntityMeta:
    name: str
    components: List[Type["Component"]]

    def __repr__(self):
        return f"<EntityMeta name={self.name}>"

    def component_names(self):
        return (component._component_meta.name for component in self.components)

    def component_related_names(self):
        return (component._component_meta.related_name for component in self.components)


# these attributes are forwarded from the entity declaration to the django Meta
PASSTHROUGH_ATTR_NAMES = (
    "verbose_name",
    "verbose_name_plural",
)


ALL_ENTITY_TYPES = []


class EntityBase(type(models.Model)):
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
        for comp in components:
            assert issubclass(
                comp, Component
            ), f"{comp} isn't a Component, and thus can't be part of {class_name}"

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
            "_entity_meta": EntityMeta(entity_name, components),
        }

        # this local variable is used by the dj_init closure above
        entity_type = super().__new__(cls, class_name, dj_bases, dj_attrs, **kwargs)
        ALL_ENTITY_TYPES.append(entity_type)
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

    __slots__ = ("name", "related_name", "unique")

    name: str
    related_name: str
    unique: bool

    def __init__(self, name, related_name, unique):
        self.name = name
        self.related_name = related_name
        self.unique = unique

    @staticmethod
    def from_meta_class(class_name, meta_class):
        assert meta_class is not None, f"{class_name} has no ComponentMeta"

        # make a dict we can pop items off
        meta = dict(
            ((k, v) for k, v in meta_class.__dict__.items() if not k.startswith("__"))
        )

        name = meta.pop("name", None)
        assert name is not None, f"{class_name}'s ComponentMeta has no name"

        unique = meta.pop("unique", False)

        related_name = meta.pop("related_name", None)
        if related_name is None:
            related_name = name if unique else f"{name}_set"

        assert (
            not meta
        ), f"{class_name} has unknown ComponentMeta settings: {','.join(meta)}"
        return ComponentMeta(name, related_name, unique)

    def __repr__(self):
        return (
            f"<ComponentMeta name={self.name} "
            f"related_name={self.related_name} "
            f"unique={self.unique}>"
        )


ALL_COMPONENT_TYPES = []


class ComponentBase(type(models.Model)):
    """
    This metaclass preprocesses component classes before passing them on to django.
    It adds a component_meta attribute to the class, and setups a sane default related_name
    from the component name.
    """

    def __new__(cls, name, bases, attrs, component_base_passthrough=False):
        if component_base_passthrough:
            return super().__new__(cls, name, bases, attrs)

        django_meta = attrs.get("Meta", None)
        if django_meta is None:
            django_meta = type("Meta", (), {})

        assert not getattr(
            django_meta, "abstract", False
        ), "abstract components aren't supported"

        component_meta = ComponentMeta.from_meta_class(
            name, attrs.get("ComponentMeta", None)
        )
        attrs["_component_meta"] = component_meta

        # synthesize relevant django meta
        if getattr(django_meta, "default_related_name", None) is None:
            django_meta.default_related_name = f"{component_meta.name}_set"

        # add the relation to the entity
        assert "entity" not in attrs, "entity is a reserved component field name"
        field_type = (
            models.OneToOneField if component_meta.unique else models.ForeignKey
        )
        attrs["entity"] = field_type(
            "Entity",
            on_delete=models.CASCADE,
            db_index=True,
            related_name=component_meta.related_name,
        )

        # call the django model metaclass
        component_type = super().__new__(cls, name, bases, attrs)
        assert getattr(component_type, "_meta", None) is not None
        ALL_COMPONENT_TYPES.append(component_type)
        return component_type


class Component(models.Model, metaclass=ComponentBase, component_base_passthrough=True):
    component_id = models.BigAutoField(primary_key=True)

    class Meta:
        abstract = True


# UTILITIES


def fetch_entities(model, namespace):
    return (
        getattr(model, "objects")
        .filter(namespace=namespace)
        .prefetch_related(*model._entity_meta.component_related_names())
    )


def get_entity_meta(model: Type[Entity]) -> EntityMeta:
    entity_meta: EntityMeta = getattr(model, "_entity_meta", None)
    assert entity_meta is not None
    return entity_meta


def get_component_meta(model: Type[Component]) -> ComponentMeta:
    component_meta: ComponentMeta = getattr(model, "_component_meta", None)
    assert component_meta is not None
    return component_meta
