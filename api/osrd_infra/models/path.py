from django.conf import settings
from django.contrib.gis.db import models

from osrd_infra.models import Infra
from osrd_infra.schemas.path import Curves, PathPayload, Slopes
from osrd_infra.utils import JSONSchemaValidator


class PathModel(models.Model):
    owner = models.UUIDField(editable=False, default="00000000-0000-0000-0000-000000000000")
    infra = models.ForeignKey(Infra, on_delete=models.CASCADE)
    created = models.DateTimeField(editable=False, auto_now_add=True)
    payload = models.JSONField(validators=[JSONSchemaValidator(limit_value=PathPayload.schema())])
    slopes = models.JSONField(validators=[JSONSchemaValidator(limit_value=Slopes.schema())])
    curves = models.JSONField(validators=[JSONSchemaValidator(limit_value=Curves.schema())])
    geographic = models.LineStringField(srid=settings.RAILJSON_SRID)
    schematic = models.LineStringField(srid=settings.RAILJSON_SRID)

    class Meta:
        verbose_name_plural = "paths"

    def get_initial_location(self):
        path = self.payload["route_paths"]
        track_range = path[0]["track_sections"][0]
        return {
            "track_section": track_range["track"]["id"],
            "offset": track_range["begin"],
        }

    def get_end_location(self):
        path = self.payload["route_paths"]
        track_range = path[-1]["track_sections"][-1]
        return {
            "track_section": track_range["track"]["id"],
            "offset": track_range["end"],
        }

    def get_initial_route(self):
        return self.payload["route_paths"][0]["route"]["id"]
