from django.contrib.gis.db import models
from osrd_infra.models.infra import Infra
from osrd_infra.models.rolling_stock import RollingStock, JSONSchemaValidator
from osrd_infra.models.pathfinding import Path


PHASES_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "required": ["position", "stop_time", "operational_point"],
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
            "stop_time": {"type": "number"},
            "operational_point": {"type": "number"},
        },
    },
    "title": "schema",
}


class Timetable(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.DO_NOTHING)
    name = models.CharField(max_length=128)


class TrainSchedule(models.Model):
    train_id = models.CharField(max_length=128)
    timetable = models.ForeignKey(
        Timetable, on_delete=models.CASCADE, related_name="train_schedules"
    )
    rolling_stock = models.ForeignKey(RollingStock, on_delete=models.DO_NOTHING)
    departure_time = models.FloatField()
    path = models.ForeignKey(Path, on_delete=models.CASCADE)
    phases = models.JSONField(
        validators=[JSONSchemaValidator(limit_value=PHASES_SCHEMA)]
    )
    initial_speed = models.FloatField()


class TrainScheduleResult(models.Model):
    train_schedule = models.ForeignKey(
        TrainSchedule, on_delete=models.CASCADE, related_name="output", unique=True
    )
    log = models.JSONField()


class Simulation(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.DO_NOTHING)
    timetable = models.ForeignKey(Timetable, on_delete=models.DO_NOTHING)
    start_time = models.DateTimeField(auto_now_add=True)
    started_by = models.UUIDField()
