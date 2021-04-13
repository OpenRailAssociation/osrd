from django.contrib.gis.db import models
from .ecs import Component, Entity
from .common import EndpointField


class TrackSectionLocation(Component):
    track_section = models.ForeignKey("TrackSection", on_delete=models.CASCADE)
    offset = models.FloatField()


class TrackSectionRange(Component):
    track_section = models.ForeignKey("TrackSection", on_delete=models.CASCADE)
    start_offset = models.FloatField()
    end_offset = models.FloatField()


class PointLocation(Component):
    location = models.PointField()


class Identifier(Component):
    identifier = models.CharField(max_length=255)


class Infra(Entity):
    pass


class TrackSection(Entity):
    identifier = models.ForeignKey("Identifier", on_delete=models.CASCADE)

    infra = models.ForeignKey("Infra", on_delete=models.CASCADE)
    path = models.LineStringField()


class Switch(Entity):
    identifier = models.ForeignKey("Identifier", on_delete=models.CASCADE)

    base_track_section = models.ForeignKey(
        "TrackSection",
        on_delete=models.CASCADE,
        related_name="switch_base_branches"
    )
    base_endpoint = EndpointField()

    left_track_section = models.ForeignKey(
        "TrackSection",
        on_delete=models.CASCADE,
        related_name="switch_left_branches"
    )
    left_endpoint = EndpointField()

    right_track_section = models.ForeignKey(
        "TrackSection",
        on_delete=models.CASCADE,
        related_name="switch_right_branches"
    )
    right_endpoint = EndpointField()


class TrackSectionLink(Entity):
    identifier = models.ForeignKey("Identifier", on_delete=models.CASCADE)

    begin_track_section = models.ForeignKey(
        "TrackSection",
        on_delete=models.CASCADE,
        related_name="link_begin_branches"
    )
    begin_endpoint = EndpointField()

    end_track_section = models.ForeignKey(
        "TrackSection",
        on_delete=models.CASCADE,
        related_name="link_end_branches"
    )
    end_endpoint = EndpointField()


class OperationalPoint(Entity):
    identifier = models.ForeignKey("Identifier", on_delete=models.CASCADE)


class OperationalPointPart(Entity):
    track_range = models.ForeignKey("TrackSectionRange", on_delete=models.CASCADE)
    operational_point = models.ForeignKey("OperationalPoint", on_delete=models.CASCADE)


class Signal(Entity):
    identifier = models.ForeignKey("Identifier", on_delete=models.CASCADE)
    location = models.ForeignKey("TrackSectionLocation", on_delete=models.CASCADE)
