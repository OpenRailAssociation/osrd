from django.contrib.gis.db import models
from osrd_infra.models.ecs import Component, Entity
from osrd_infra.models.common import EndpointField
from django.conf import settings


class Infra(models.Model):
    name = models.CharField(max_length=128)
    owner = models.UUIDField()
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class TrackSectionLocation(Component):
    track_section = models.ForeignKey("TrackSection", on_delete=models.CASCADE)
    offset = models.FloatField()


class TrackSectionLocationEntity(models.Model):
    location = models.OneToOneField("TrackSectionLocation", on_delete=models.CASCADE)

    class Meta:
        abstract = True


class TrackSectionRange(Component):
    track_section = models.ForeignKey("TrackSection", on_delete=models.CASCADE)
    start_offset = models.FloatField()
    end_offset = models.FloatField()


class Identifier(Component):
    name = models.CharField(max_length=255)


class IdentifiedEntity(models.Model):
    identity = models.OneToOneField("Identifier", on_delete=models.CASCADE)

    class Meta:
        abstract = True


class TrackSection(Entity, IdentifiedEntity):
    infra = models.ForeignKey("Infra", on_delete=models.CASCADE)
    path = models.LineStringField(srid=settings.OSRD_INFRA_SRID)


class Switch(Entity, IdentifiedEntity):
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


class TrackSectionLink(Entity, IdentifiedEntity):
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


class OperationalPoint(Entity, IdentifiedEntity):
    pass


class OperationalPointPart(Entity):
    track_range = models.OneToOneField("TrackSectionRange", on_delete=models.CASCADE)
    operational_point = models.ForeignKey("OperationalPoint", related_name="parts", on_delete=models.CASCADE)


class Signal(Entity, IdentifiedEntity, TrackSectionLocationEntity):
    pass
