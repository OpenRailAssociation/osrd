from django.conf import settings
from django.contrib.gis.db import models

from osrd_infra.models import EntityNamespace
from osrd_infra.utils import JSONSchemaValidator

PAYLOAD_SCHEMA = {
    "type": "object",
    "required": ["path", "steps"],
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
        },
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["name", "position", "suggestion", "stop_time"],
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
                    "name": {"type": "string"},
                    "suggestion": {"type": "boolean"},
                    "stop_time": {"type": "number"},
                    "geographic": {
                        "type": "array",
                        "items": {"type": "number"},
                        "minItems": 2,
                        "maxItems": 2,
                    },
                    "schematic": {
                        "type": "array",
                        "items": {"type": "number"},
                        "minItems": 2,
                        "maxItems": 2,
                    },
                },
            },
        },
    },
}

VMAX_SCHEMA = {
    "type": "array",
    "minItems": 2,
    "items": {
        "type": "object",
        "required": ["position", "speed"],
        "additionalProperties": False,
        "properties": {
            "position": {"type": "number"},
            "speed": {"type": "number"},
        },
    },
}


def format_track_section_id(entity_id: int) -> str:
    return f"track_section.{entity_id}"


class Path(models.Model):
    name = models.CharField(max_length=128, blank=False)
    owner = models.UUIDField(editable=False, default="00000000-0000-0000-0000-000000000000")
    namespace = models.ForeignKey(EntityNamespace, on_delete=models.CASCADE)
    created = models.DateTimeField(editable=False, auto_now_add=True)
    payload = models.JSONField(validators=[JSONSchemaValidator(limit_value=PAYLOAD_SCHEMA)])
    vmax = models.JSONField(validators=[JSONSchemaValidator(limit_value=VMAX_SCHEMA)])
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
