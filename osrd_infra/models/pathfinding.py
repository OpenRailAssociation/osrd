from django.contrib.gis.db import models
from osrd_infra.models import EntityNamespace
from django.conf import settings
from osrd_infra.models.rolling_stock import JSONSchemaValidator


PAYLOAD_SCHEMA = {
    "type": "object",
    "required": ["path", "operational_points"],
    "additionalProperties": False,
    "properties": {
        "path": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["route", "track_sections"],
                "additionalProperties": False,
                "properties": {
                    "route": {"type": "number"},
                    "track_sections": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["begin", "end", "track_section"],
                            "properties": {
                                "begin": {"type": "number"},
                                "end": {"type": "number"},
                                "track_section": {"type": "number"},
                            },
                        },
                    },
                },
            },
            "title": "schema",
        },
        "operational_points": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["op", "position"],
                "additionalProperties": False,
                "properties": {
                    "position": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["offset", "track_section"],
                        "properties": {
                            "offset": {"type": "number"},
                            "track_section": {"type": "number"},
                        },
                    },
                    "op": {"type": "number"},
                },
            },
            "title": "schema",
        },
    },
}


def format_track_section_id(entity_id: int) -> str:
    return f"track_section.{entity_id}"


class Path(models.Model):
    name = models.CharField(max_length=128, blank=False)
    owner = models.UUIDField(
        editable=False, default="00000000-0000-0000-0000-000000000000"
    )
    namespace = models.ForeignKey(EntityNamespace, on_delete=models.CASCADE)
    created = models.DateTimeField(editable=False, auto_now_add=True)
    payload = models.JSONField(
        validators=[JSONSchemaValidator(limit_value=PAYLOAD_SCHEMA)]
    )
    geographic = models.LineStringField(srid=settings.OSRD_INFRA_SRID)
    schematic = models.LineStringField(srid=settings.OSRD_INFRA_SRID)

    def __str__(self):
        return self.name

    def get_initial_location(self):
        path = self.payload["path"]
        track = path[0]["track_sections"][0]
        return {
            "track_section": format_track_section_id(track["track_section"]),
            "offset": track["begin"],
        }

    def get_end_location(self):
        path = self.payload["path"]
        track = path[-1]["track_sections"][-1]
        return {
            "track_section": format_track_section_id(track["track_section"]),
            "offset": track["end"],
        }

    def get_initial_route(self):
        return self.payload["path"][0]["route"]
