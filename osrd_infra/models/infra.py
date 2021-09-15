from django.contrib.gis.db import models
from osrd_infra.models.ecs import (
    Component,
    Entity,
    EntityNamespace,
)
from django.core.validators import MaxValueValidator
from django.conf import settings


class Endpoint(models.IntegerChoices):
    BEGIN = 0
    END = 1


def EndpointField():
    return models.IntegerField(choices=Endpoint.choices)


class ApplicableDirection(models.IntegerChoices):
    NORMAL = 0  # from BEGIN to END
    REVERSE = 1  # from END to BEGIN
    BOTH = 2


def ApplicableDirectionField():
    return models.IntegerField(choices=ApplicableDirection.choices)


class EdgeDirection(models.IntegerChoices):
    START_TO_STOP = 0
    STOP_TO_START = 1


def EdgeDirectionField():
    return models.IntegerField(choices=EdgeDirection.choices)


def SwitchPositionField():
    return models.IntegerField()


class WaypointType(models.IntegerChoices):
    BUFFER_STOP = 0
    DETECTOR = 1


def WaypointTypeField():
    return models.IntegerField(choices=WaypointType.choices)


class SignalingType(models.IntegerChoices):
    BAL = 0
    BAL_VB = 1
    BAPR_DV = 2
    BAPR_VB = 3
    BM_VU = 4
    BM_VU_SE = 5
    BM_CV = 6
    BM_U = 7
    BM_AMU = 8
    BM_NB = 9
    BM_LU = 10
    BM_LUS = 11
    BM_SEUS = 12
    CAPI = 13
    CT_DV = 14
    CT_VU = 15
    TVM300 = 16
    TVM430 = 18
    ETCS_1 = 19
    ETCS_2 = 20
    ETCS_3 = 21
    TRMW = 22
    AUTRE = 23


def SignalingTypeField():
    return models.IntegerField(choices=SignalingType.choices)


class Infra(models.Model):
    name = models.CharField(max_length=128)
    owner = models.UUIDField(
        editable=False, default="00000000-0000-0000-0000-000000000000"
    )
    created = models.DateTimeField(editable=False, auto_now_add=True)
    modified = models.DateTimeField(editable=False, auto_now=True)
    # the namespace is the container for all the entities in the infrastructure
    namespace = models.ForeignKey(
        EntityNamespace, on_delete=models.CASCADE, editable=False
    )

    def save(self, **kwargs):
        if not self.namespace_id:
            self.namespace = EntityNamespace()
            self.namespace.save()
        super().save()

    def delete(self, *args, **kwargs):
        self.namespace.delete()
        super().delete()

    def __str__(self):
        return self.name


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


class GeoLinesLocationComponent(Component):
    geographic = models.MultiLineStringField(srid=settings.OSRD_INFRA_SRID)
    schematic = models.MultiLineStringField(srid=settings.OSRD_INFRA_SRID)

    class ComponentMeta:
        name = "geo_lines_location"
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
        unique = True


class TrackSectionRangeComponent(Component):
    """A component for entities which are ranges on a track section"""

    track_section = models.ForeignKey(
        "TrackSectionEntity", on_delete=models.CASCADE, related_name="range_objects"
    )
    start_offset = models.FloatField()
    end_offset = models.FloatField()

    class ComponentMeta:
        name = "range_location"


class TrackSectionSlopeComponent(Component):
    """A track section component that define a slope in a specific range"""

    gradient = models.FloatField()
    start_offset = models.FloatField()
    end_offset = models.FloatField()

    class ComponentMeta:
        name = "slope"


class TrackSectionCurveComponent(Component):
    """A track section component that define a curve in a specific range"""

    radius = models.FloatField()
    start_offset = models.FloatField()
    end_offset = models.FloatField()

    class ComponentMeta:
        name = "curve"


class TrackSectionSignalingTypeComponent(Component):
    """A track section component that define a signaling system in a specific range"""

    signaling_type = SignalingTypeField()
    start_offset = models.FloatField()
    end_offset = models.FloatField()

    class ComponentMeta:
        name = "signaling_type"


class TrackSectionElectrificationTypeComponent(Component):
    """A track section component that define a type of electrification in a specific range"""

    electrification_type = models.IntegerField()
    start_offset = models.FloatField()
    end_offset = models.FloatField()

    class ComponentMeta:
        name = "electrification_type"


class IdentifierComponent(Component):
    database = models.CharField(max_length=255)
    name = models.CharField(max_length=255)

    def __repr__(self):
        return f"<IdentifierComponent database={self.database}, name={self.name}>"

    class ComponentMeta:
        name = "identifier"


class TrackSectionComponent(Component):
    # the length of the track section, in meters
    length = models.FloatField()
    line_code = models.IntegerField()
    line_name = models.CharField(max_length=255)
    track_number = models.IntegerField()
    track_name = models.CharField(max_length=255)

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
        unique = True


class SwitchComponent(Component):
    links = models.JSONField(default=list)

    class ComponentMeta:
        name = "switch"
        unique = True


class KilometricPointComponent(Component):
    value = models.CharField(max_length=255)

    class ComponentMeta:
        name = "kilometric_point"


class ApplicableDirectionComponent(Component):
    applicable_direction = ApplicableDirectionField()

    class ComponentMeta:
        name = "applicable_direction"
        unique = True


class RailScriptComponent(Component):
    script = models.JSONField()

    class ComponentMeta:
        name = "rail_script"
        unique = True


class AspectConstraintComponent(Component):
    constraint = models.JSONField()

    class ComponentMeta:
        name = "constraint"


class SpeedSectionComponent(Component):
    speed = models.FloatField()
    is_signalized = models.BooleanField()

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(speed__gte=0),
                name="speed__gte=0",
            ),
        ]

    class ComponentMeta:
        name = "speed_section"
        unique = True


class BelongsToTVDSectionComponent(Component):
    tvd_section = models.ForeignKey(
        "TVDSectionEntity",
        on_delete=models.CASCADE,
        related_name="tvd_section_components",
    )

    class ComponentMeta:
        name = "belong_to_tvd_section"


class BerthingComponent(Component):
    is_berthing = models.BooleanField()

    class ComponentMeta:
        name = "berthing"
        unique = True


class SwitchPositionComponent(Component):
    switch = models.ForeignKey("SwitchEntity", on_delete=models.CASCADE)
    position = SwitchPositionField()

    class ComponentMeta:
        name = "switch_position"


class WaypointComponent(Component):
    waypoint_type = WaypointTypeField()

    class ComponentMeta:
        name = "waypoint"
        unique = True


class SignalComponent(Component):
    linked_detector = models.ForeignKey(
        "WaypointEntity",
        on_delete=models.CASCADE,
        related_name="linked_detector",
        default=None,
        blank=True,
        null=True,
    )
    sight_distance = models.FloatField()

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(sight_distance__gte=0),
                name="sight_distance__gte=0",
            ),
        ]

    class ComponentMeta:
        name = "signal"
        unique = True


class ReleaseGroupComponent(Component):
    tvd_sections = models.ManyToManyField("TVDSectionEntity")

    class ComponentMeta:
        name = "release_group"


class RouteComponent(Component):
    entry_point = models.ForeignKey(
        "WaypointEntity", on_delete=models.CASCADE, related_name="entry_routes"
    )
    entry_direction = EdgeDirectionField()
    exit_point = models.ForeignKey(
        "WaypointEntity", on_delete=models.CASCADE, related_name="exit_routes"
    )

    class ComponentMeta:
        name = "route"
        unique = True


class TrackSectionEntity(Entity):
    name = "track_section"
    verbose_name_plural = "track section entities"
    components = [
        TrackSectionComponent,
        GeoLineLocationComponent,
        IdentifierComponent,
        TrackSectionSlopeComponent,
        TrackSectionCurveComponent,
        TrackSectionSignalingTypeComponent,
        TrackSectionElectrificationTypeComponent,
    ]


class SwitchEntity(Entity):
    name = "switch"
    verbose_name_plural = "switch entities"
    components = [
        IdentifierComponent,
        GeoPointLocationComponent,
        SwitchComponent,
    ]


class TrackSectionLinkEntity(Entity):
    name = "track_section_link"
    verbose_name_plural = "track section link entities"
    components = [
        IdentifierComponent,
        GeoPointLocationComponent,
        TrackSectionLinkComponent,
    ]


class OperationalPointComponent(Component):
    ci = models.IntegerField()
    ch = models.CharField(max_length=2)
    ch_short_label = models.CharField(max_length=255, null=True)
    ch_long_label = models.CharField(max_length=255, null=True)
    name = models.CharField(max_length=255)

    class ComponentMeta:
        name = "operational_point"
        unique = True


class OperationalPointEntity(Entity):
    name = "operational_point"
    verbose_name_plural = "operational point entities"
    components = [
        IdentifierComponent,
        OperationalPointComponent,
    ]


class OperationalPointPartComponent(Component):
    operational_point = models.ForeignKey(
        OperationalPointEntity, on_delete=models.CASCADE
    )

    class ComponentMeta:
        name = "operational_point_part"
        unique = True


class OperationalPointPartEntity(Entity):
    name = "operational_point_part"
    verbose_name_plural = "operational point part entities"
    components = [
        OperationalPointPartComponent,
        GeoPointLocationComponent,
        TrackSectionLocationComponent,
    ]


class SignalEntity(Entity):
    name = "signal"
    verbose_name_plural = "signal entities"
    components = [
        IdentifierComponent,
        GeoPointLocationComponent,
        TrackSectionLocationComponent,
        TrackAngleComponent,
        ApplicableDirectionComponent,
        RailScriptComponent,
        SignalComponent,
    ]


class ScriptFunctionEntity(Entity):
    name = "script_function"
    verbose_name_plural = "script functions"
    components = [RailScriptComponent]


class SpeedSectionEntity(Entity):
    name = "speed_section"
    verbose_name_plural = "speed section entities"
    components = [
        IdentifierComponent,
        GeoAreaLocationComponent,
        SpeedSectionComponent,
    ]


class SpeedSectionPartComponent(Component):
    speed_section = models.ForeignKey(SpeedSectionEntity, on_delete=models.CASCADE)

    class ComponentMeta:
        name = "speed_section_part"
        unique = True


class SpeedSectionPartEntity(Entity):
    name = "speed_section_part"
    verbose_name_plural = "speed section part entities"
    components = [
        SpeedSectionPartComponent,
        GeoLineLocationComponent,
        TrackSectionRangeComponent,
        ApplicableDirectionComponent,
    ]


class WaypointEntity(Entity):
    name = "waypoint"
    verbose_name_plural = "waypoint entities"
    components = [
        IdentifierComponent,
        GeoPointLocationComponent,
        TrackSectionLocationComponent,
        ApplicableDirectionComponent,
        BelongsToTVDSectionComponent,
        WaypointComponent,
    ]


class TVDSectionEntity(Entity):
    name = "tvd_section"
    verbose_name_plural = "TVD section entities"
    components = [
        IdentifierComponent,
        BerthingComponent,
        GeoLinesLocationComponent,
    ]


class RouteEntity(Entity):
    name = "route"
    verbose_name_plural = "routes"
    components = [
        IdentifierComponent,
        SwitchPositionComponent,
        ReleaseGroupComponent,
        RouteComponent,
    ]


class AspectEntity(Entity):
    name = "aspect"
    verbose_name_plural = "aspects"
    components = [
        IdentifierComponent,
        AspectConstraintComponent,
    ]
