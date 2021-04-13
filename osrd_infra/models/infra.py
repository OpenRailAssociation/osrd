from django.contrib.gis.db import models
from .ecs import Component, Entity
from .common import EndpointField
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

    @property
    def track_section(self):
        return self.location.track_section_id

    @track_section.setter
    def set_track_section(self, value):
        self.location.track_section_id = value

    @property
    def offset(self):
        return self.location.offset

    @offset.setter
    def set_offset(self, value):
        self.location.offset = value

    class Meta:
        abstract = True


class TrackSectionRange(Component):
    track_section = models.ForeignKey("TrackSection", on_delete=models.CASCADE)
    start_offset = models.FloatField()
    end_offset = models.FloatField()


class Identifier(Component):
    name = models.CharField(max_length=255)


class IdentifiedEntity(models.Model):
    identifier = models.OneToOneField("Identifier", on_delete=models.CASCADE)

    @property
    def name(self):
        return self.identifier.name

    @name.setter
    def set_name(self, value):
        self.identifier.name = value

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
    operational_point = models.OneToOneField("OperationalPoint", on_delete=models.CASCADE)


class Signal(Entity, IdentifiedEntity, TrackSectionLocationEntity):
    pass
