from django.contrib.gis.db import models
from osrd_infra.models import EntityNamespace
from django.conf import settings


class Path(models.Model):
    name = models.CharField(max_length=128, blank=False)
    owner = models.UUIDField(
        editable=False, default="00000000-0000-0000-0000-000000000000"
    )
    namespace = models.ForeignKey(EntityNamespace, on_delete=models.CASCADE)
    created = models.DateTimeField(editable=False, auto_now_add=True)
    payload = models.JSONField()
    geographic = models.LineStringField(srid=settings.OSRD_INFRA_SRID)
    schematic = models.LineStringField(srid=settings.OSRD_INFRA_SRID)

    def __str__(self):
        return self.name
