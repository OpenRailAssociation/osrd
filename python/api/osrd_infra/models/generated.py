from django.conf import settings
from django.contrib.gis.db import models
from osrd_schemas.generated import InfraError
from osrd_schemas.infra import Panel

from osrd_infra.utils import PydanticValidator


class ErrorLayer(models.Model):
    infra = models.ForeignKey("Infra", on_delete=models.CASCADE)
    geographic = models.GeometryField(srid=settings.MAPBOX_SRID, null=True)
    schematic = models.GeometryField(srid=settings.MAPBOX_SRID, null=True)
    information = models.JSONField(validators=[PydanticValidator(InfraError)])

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


class TrackSectionLinkLayer(models.Model):
    infra = models.ForeignKey("Infra", on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    geographic = models.PointField(srid=settings.MAPBOX_SRID)
    schematic = models.PointField(srid=settings.MAPBOX_SRID)

    class Meta:
        verbose_name_plural = "generated track section links layer"
        unique_together = (("infra", "obj_id"),)


class SwitchLayer(models.Model):
    infra = models.ForeignKey("Infra", on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    geographic = models.PointField(srid=settings.MAPBOX_SRID)
    schematic = models.PointField(srid=settings.MAPBOX_SRID)

    class Meta:
        verbose_name_plural = "generated switch layer"
        unique_together = (("infra", "obj_id"),)


class DetectorLayer(models.Model):
    infra = models.ForeignKey("Infra", on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    geographic = models.PointField(srid=settings.MAPBOX_SRID)
    schematic = models.PointField(srid=settings.MAPBOX_SRID)

    class Meta:
        verbose_name_plural = "generated detector layer"
        unique_together = (("infra", "obj_id"),)


class BufferStopLayer(models.Model):
    infra = models.ForeignKey("Infra", on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    geographic = models.PointField(srid=settings.MAPBOX_SRID)
    schematic = models.PointField(srid=settings.MAPBOX_SRID)

    class Meta:
        verbose_name_plural = "generated buffer stop layer"
        unique_together = (("infra", "obj_id"),)


class OperationalPointLayer(models.Model):
    infra = models.ForeignKey("Infra", on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    geographic = models.MultiPointField(srid=settings.MAPBOX_SRID)
    schematic = models.MultiPointField(srid=settings.MAPBOX_SRID)

    class Meta:
        verbose_name_plural = "generated operational point layer"
        unique_together = (("infra", "obj_id"),)


class CatenaryLayer(models.Model):
    infra = models.ForeignKey("Infra", on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    geographic = models.MultiLineStringField(srid=settings.MAPBOX_SRID)
    schematic = models.MultiLineStringField(srid=settings.MAPBOX_SRID)

    class Meta:
        verbose_name_plural = "generated catenary layer"
        unique_together = (("infra", "obj_id"),)


class LPVPanelLayer(models.Model):
    infra = models.ForeignKey("Infra", on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    geographic = models.PointField(srid=settings.MAPBOX_SRID)
    schematic = models.PointField(srid=settings.MAPBOX_SRID)
    data = models.JSONField(validators=[PydanticValidator(Panel)])
