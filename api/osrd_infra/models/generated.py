from django.conf import settings
from django.contrib.gis.db import models


class GeneratedInfra(models.Model):
    infra = models.OneToOneField("Infra", on_delete=models.CASCADE, primary_key=True, related_name="generated")
    version = models.PositiveBigIntegerField(editable=False, default=0)


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
