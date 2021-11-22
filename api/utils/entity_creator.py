from dataclasses import dataclass
from osrd_infra.models import Component, Entity
from django.db.models import Model, Field
from typing import List, Mapping
from collections import defaultdict


@dataclass(eq=False)
class PendingEntity:
    entity: Entity
    components: List[Component]

    def add_component(self, component):
        self.components.append(component)
        return component


class EntityCreator:
    __slots__ = ("entity_type", "namespace", "pending_entities", "m2m_by_field")

    def __init__(self, entity_type, namespace):
        self.entity_type = entity_type
        self.namespace = namespace
        self.pending_entities = []
        self.m2m_by_field: Mapping[Field, List[Model]] = defaultdict(list)

    def create_entity(self) -> PendingEntity:
        entity = self.entity_type(namespace=self.namespace)
        pending_entity = PendingEntity(entity, [])
        self.pending_entities.append(pending_entity)
        return pending_entity

    def delete(self, entity):
        self.pending_entities.remove(entity)

    def create_m2m_relation(self, field: Field, component: Component, entity: Entity):
        self.m2m_by_field[field].append((component, entity))

    def create(self):
        # create all entities
        entities = [pending_entity.entity for pending_entity in self.pending_entities]
        self.entity_type.objects.bulk_create(entities)

        # link components with their entities
        for pending_entity in self.pending_entities:
            for component in pending_entity.components:
                component.entity = pending_entity.entity

        # partition components by type to prepare bulk creation
        components_by_type = defaultdict(list)
        for pending_entity in self.pending_entities:
            for component in pending_entity.components:
                components_by_type[type(component)].append(component)

        # create all components, one type at a time
        for component_type, components in components_by_type.items():
            component_type.objects.bulk_create(components)

        # create all m2m relations
        for field, relations in self.m2m_by_field.items():
            through_relations = [
                field.through(None, relation[0].pk, relation[1].pk)
                for relation in relations
            ]
            field.through.objects.bulk_create(through_relations)

        self.pending_entities.clear()
        self.m2m_by_field.clear()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, exc_traceback):
        self.create()


class ComponentCreator:
    __slots__ = "components"

    def __init__(self):
        self.components: Mapping[Model, List[Component]] = defaultdict(list)

    def add(self, component):
        self.components[type(component)].append(component)

    def create(self):
        # create all components, one type at a time
        for component_type, components in self.components.items():
            component_type.objects.bulk_create(components)

        self.components.clear()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, exc_traceback):
        self.create()
