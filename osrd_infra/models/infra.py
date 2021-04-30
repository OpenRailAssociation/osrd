from django.contrib.gis.db import models
from osrd_infra.models.ecs import (
    Component,
    Entity,
    EntityNamespace,
)
from django.core.validators import MaxValueValidator
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


class GeoPointLocationComponent(Component):
    geographic = models.PointField(srid=settings.OSRD_INFRA_SRID)
    schematic = models.PointField(srid=settings.OSRD_INFRA_SRID)

    class ComponentMeta:
        name = "geo_point_location"
        unique = True


class GeoAreaLocationComponent(Component):
    geographic = models.PolygonField(srid=settings.OSRD_INFRA_SRID)
    schematic = models.PolygonField(srid=settings.OSRD_INFRA_SRID)

    class ComponentMeta:
        name = "geo_area_location"
        unique = True


class GeoLineLocationComponent(Component):
    geographic = models.LineStringField(srid=settings.OSRD_INFRA_SRID)
    schematic = models.LineStringField(srid=settings.OSRD_INFRA_SRID)

    class ComponentMeta:
        name = "geo_line_location"
        unique = True


class TrackAngleComponent(Component):
    geographic = models.PositiveSmallIntegerField(validators=[MaxValueValidator(379)])
    schematic = models.PositiveSmallIntegerField(validators=[MaxValueValidator(379)])

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(geographic__lte=379),
                name="geographic__lte=379",
            ),
            models.CheckConstraint(
                check=models.Q(schematic__lte=379),
                name="schematic__lte=379",
            ),
        ]

    class ComponentMeta:
        name = "track_angle"
        unique = True


class TrackSectionLocationComponent(Component):
    """The component holding location information for point objects on track sections"""

    track_section = models.ForeignKey(
        "TrackSectionEntity", on_delete=models.CASCADE, related_name="point_objects"
    )
    offset = models.FloatField()

    class ComponentMeta:
        name = "point_location"


class BelongsToTrackComponent(Component):
    track = models.ForeignKey(
        "TrackEntity", on_delete=models.CASCADE, related_name="track_components"
    )

    class ComponentMeta:
        name = "belong_to_track"


class BelongsToLineComponent(Component):
    line = models.ForeignKey(
        "LineEntity", on_delete=models.CASCADE, related_name="line_components"
    )

    class ComponentMeta:
        name = "belong_to_line"


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
        GeoLineLocationComponent,
        IdentifierComponent,
        BelongsToTrackComponent,
    ]


class SwitchEntity(Entity):
    name = "switch"
    verbose_name_plural = "switch entities"
    components = [
        IdentifierComponent,
        GeoPointLocationComponent,
        TrackSectionLinkComponent,
    ]


class TrackSectionLinkEntity(Entity):
    name = "track_section_link"
    verbose_name_plural = "track section link entities"
    components = [
        IdentifierComponent,
        GeoPointLocationComponent,
        TrackSectionLinkComponent,
    ]


class OperationalPointEntity(Entity):
    name = "operational_point"
    verbose_name_plural = "operational point entities"
    components = [
        IdentifierComponent,
        GeoAreaLocationComponent,
    ]


class OperationalPointPartComponent(Component):
    operational_point = models.ForeignKey(
        OperationalPointEntity, on_delete=models.CASCADE
    )

    class ComponentMeta:
        name = "operational_point_part"


class OperationalPointPartEntity(Entity):
    name = "operational_point"
    verbose_name_plural = "operational point part entities"
    components = [
        OperationalPointPartComponent,
        GeoLineLocationComponent,
        TrackSectionRangeComponent,
    ]


class SignalEntity(Entity):
    name = "signal"
    verbose_name_plural = "signal entities"
    components = [
        IdentifierComponent,
        GeoPointLocationComponent,
        TrackSectionLocationComponent,
        TrackAngleComponent,
    ]


class TrackEntity(Entity):
    name = "track"
    verbose_name_plural = "tracks"
    components = [
        IdentifierComponent,
        BelongsToLineComponent,
    ]


class LineEntity(Entity):
    name = "line"
    verbose_name_plural = "lines"
    components = [
        IdentifierComponent,
    ]
