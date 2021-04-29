from django.contrib.gis.db import models
from osrd_infra.models.ecs import (
    Component,
    Entity,
    EntityNamespace,
)
from osrd_infra.models.common import EndpointField
from django.conf import settings


class Infra(models.Model):
    name = models.CharField(max_length=128)
    owner = models.UUIDField(default="00000000-0000-0000-0000-000000000000")
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    # the namespace is the container for all the entities in the infrastructure
    namespace = models.ForeignKey(EntityNamespace, on_delete=models.CASCADE)

    def __str__(self):
        return self.name


class IdentifierDatabase(models.Model):
    """A database mapping identifiers to objects"""

    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["name"], name="identifier_database_unique_name"
            )
        ]


class TrackSectionLocationComponent(Component):
    """The component holding location information for point objects on track sections"""

    track_section = models.ForeignKey(
        "TrackSectionEntity", on_delete=models.CASCADE, related_name="point_objects"
    )
    offset = models.FloatField()

    class ComponentMeta:
        name = "point_location"


class TrackSectionRangeComponent(Component):
    """A component for entities which are ranges on a track section"""

    track_section = models.ForeignKey(
        "TrackSectionEntity", on_delete=models.CASCADE, related_name="range_objects"
    )
    start_offset = models.FloatField()
    end_offset = models.FloatField()

    class ComponentMeta:
        name = "range_location"


class IdentifierComponent(Component):
    database = models.ForeignKey("IdentifierDatabase", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)

    def __repr__(self):
        return f"<IdentifierComponent database={self.database}, name={self.name}>"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["database", "name"], name="identifier_unique_in_database"
            )
        ]

    class ComponentMeta:
        name = "identifier"


class TrackSectionComponent(Component):
    path = models.LineStringField(srid=settings.OSRD_INFRA_SRID)

    # the length of the track section, in meters
    length = models.FloatField()

    class ComponentMeta:
        name = "track_section"
        unique = True


class TrackSectionLinkComponent(Component):
    begin_track_section = models.ForeignKey(
        "TrackSectionEntity",
        on_delete=models.CASCADE,
        related_name="link_begin_branches",
    )
    begin_endpoint = EndpointField()

    end_track_section = models.ForeignKey(
        "TrackSectionEntity", on_delete=models.CASCADE, related_name="link_end_branches"
    )
    end_endpoint = EndpointField()

    class ComponentMeta:
        name = "track_section_link"


class TrackSectionEntity(Entity):
    name = "track_section"
    verbose_name_plural = "track section entities"
    components = [
        TrackSectionComponent,
        IdentifierComponent,
    ]


class SwitchEntity(Entity):
    name = "switch"
    verbose_name_plural = "switch entities"
    components = [
        IdentifierComponent,
        TrackSectionLinkComponent,
    ]


class TrackSectionLinkEntity(Entity):
    name = "track_section_link"
    verbose_name_plural = "track section link entities"
    components = [
        IdentifierComponent,
        TrackSectionLinkComponent,
    ]


class OperationalPointEntity(Entity):
    name = "operational_point"
    verbose_name_plural = "operational point entities"
    components = [
        IdentifierComponent,
        TrackSectionRangeComponent,
    ]


class SignalEntity(Entity):
    name = "signal"
    verbose_name_plural = "signal entities"
    components = [
        IdentifierComponent,
        TrackSectionLocationComponent,
    ]
