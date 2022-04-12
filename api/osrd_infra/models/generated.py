from django.conf import settings
from django.contrib.gis.db import models

from osrd_infra.schemas.generated import InfraError
from osrd_infra.schemas.infra import ALL_OBJECT_TYPES
from osrd_infra.utils import JSONSchemaValidator


class ErrorLayer(models.Model):
    OBJ_TYPE_CHOICES = [(obj_type.__name__, obj_type.__name__) for obj_type in ALL_OBJECT_TYPES]
    infra = models.ForeignKey("Infra", on_delete=models.CASCADE)
    obj_type = models.CharField(max_length=32, choices=OBJ_TYPE_CHOICES)
    obj_id = models.CharField(max_length=255)
    geographic = models.GeometryField(srid=settings.MAPBOX_SRID, null=True)
    schematic = models.GeometryField(srid=settings.MAPBOX_SRID, null=True)
    information = models.JSONField(validators=[JSONSchemaValidator(limit_value=InfraError.schema())])

    class Meta:
        verbose_name_plural = "generated errors"


class TrackSectionLayer(models.Model):
    infra = models.ForeignKey("Infra", on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    geographic = models.LineStringField(srid=settings.MAPBOX_SRID)
    schematic = models.LineStringField(srid=settings.MAPBOX_SRID)

    class Meta:
        verbose_name_plural = "generated track sections layer"
        unique_together = (("infra", "obj_id"),)


class SignalLayer(models.Model):
    infra = models.ForeignKey("Infra", on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    geographic = models.PointField(srid=settings.MAPBOX_SRID)
    schematic = models.PointField(srid=settings.MAPBOX_SRID)

    class Meta:
        verbose_name_plural = "generated signals layer"
        unique_together = (("infra", "obj_id"),)


class SpeedSectionLayer(models.Model):
    infra = models.ForeignKey("Infra", on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    geographic = models.MultiLineStringField(srid=settings.MAPBOX_SRID)
    schematic = models.MultiLineStringField(srid=settings.MAPBOX_SRID)

    class Meta:
        verbose_name_plural = "generated speed sections layer"
        unique_together = (("infra", "obj_id"),)
