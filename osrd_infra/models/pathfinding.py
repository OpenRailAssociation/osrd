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

    def get_initial_location(self):
        path = self.payload["path"]
        track = path[0]["track_sections"][0]
        return {
            "track_section": track["track_section"],
            "offset": track["begin"],
        }

    def get_end_location(self):
        path = self.payload["path"]
        track = path[-1]["track_sections"][-1]
        return {
            "track_section": track["track_section"],
            "offset": track["end"],
        }

    def get_initial_route(self):
        return self.payload["path"][0]["route"]
