from django.contrib.gis.db import models
from osrd_infra.models.ecs import (
    Component,
    UniqueComponent,
    Entity,
    EntityManager,
)
from osrd_infra.models.common import EndpointField
from django.conf import settings


class Infra(models.Model):
    name = models.CharField(max_length=128)
    owner = models.UUIDField(default="00000000-0000-0000-0000-000000000000")
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

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

    class Meta:
        component_name = "point_location"


class TrackSectionRangeComponent(Component):
    """A component for entities which are ranges on a track section"""

    track_section = models.ForeignKey(
        "TrackSectionEntity", on_delete=models.CASCADE, related_name="range_objects"
    )
    start_offset = models.FloatField()
    end_offset = models.FloatField()

    class Meta:
        component_name = "range_location"


class IdentifierComponent(Component):
    database = models.ForeignKey("IdentifierDatabase", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)

    def __repr__(self):
        return f"<IdentifierComponent database={self.database}, name={self.name}>"

    class Meta:
        component_name = "identifier"
        constraints = [
            models.UniqueConstraint(
                fields=["database", "name"], name="identifier_unique_in_database"
            )
        ]


class TrackSectionComponent(UniqueComponent):
    infra = models.ForeignKey("Infra", on_delete=models.CASCADE)
    path = models.LineStringField(srid=settings.OSRD_INFRA_SRID)

    # the length of the track section, in meters
    length = models.FloatField()

    class Meta:
        component_name = "track_section"


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

    class Meta:
        component_name = "track_section_link"


class TrackSectionEntity(Entity):
    name = "track_section"
    type_id = Entity.Type.TRACK_SECTION
    components = {
        TrackSectionComponent: 1,
        IdentifierComponent: 1,
    }


class SwitchEntity(Entity):
    name = "switch"
    type_id = Entity.Type.SWITCH
    components = {
        IdentifierComponent: 1,
        TrackSectionLinkComponent: ...,
    }


class TrackSectionLinkEntity(Entity):
    name = "track_section_link"
    type_id = Entity.Type.TRACK_SECTION_LINK
    components = {
        IdentifierComponent: 1,
        TrackSectionLinkComponent: 1,
    }


class OperationalPointEntity(Entity):
    name = "operational_point"
    type_id = Entity.Type.OPERATIONAL_POINT
    components = {
        IdentifierComponent: 1,
        TrackSectionRangeComponent: ...,
    }


class SignalEntity(Entity):
    name = "signal"
    type_id = Entity.Type.SIGNAL
    components = {
        IdentifierComponent: 1,
        TrackSectionLocationComponent: ...,
    }
