from django.contrib.gis.db import models

from osrd_infra.models.infra import Infra
from osrd_infra.models.pathfinding import Path
from osrd_infra.models.rolling_stock import RollingStock
from osrd_infra.utils import JSONSchemaValidator

MARGINS_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "required": ["type", "value", "begin_position", "end_position"],
        "additionalProperties": False,
        "properties": {
            "type": {"enum": ["construction", "ratio_time", "ratio_distance"]},
            "value": {"type": "number"},
            "begin_position": {"type": "number"},
            "end_position": {"type": "number"},
        },
    },
}


class Timetable(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.CASCADE)
    name = models.CharField(max_length=128)


class TrainSchedule(models.Model):
    train_name = models.CharField(max_length=128)
    timetable = models.ForeignKey(Timetable, on_delete=models.CASCADE, related_name="train_schedules")
    rolling_stock = models.ForeignKey(RollingStock, on_delete=models.CASCADE)
    departure_time = models.FloatField()
    path = models.ForeignKey(Path, on_delete=models.CASCADE)
    initial_speed = models.FloatField()
    labels = models.ManyToManyField("TrainScheduleLabel", blank=True)
    margins = models.JSONField(null=True, validators=[JSONSchemaValidator(limit_value=MARGINS_SCHEMA)])
    base_simulation_log = models.JSONField(null=True)
    eco_simulation_log = models.JSONField(null=True)


class Simulation(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.DO_NOTHING)
    timetable = models.ForeignKey(Timetable, on_delete=models.DO_NOTHING)
    start_time = models.DateTimeField(auto_now_add=True)
    started_by = models.UUIDField()


class TrainScheduleLabel(models.Model):
    label = models.CharField(max_length=128, unique=True)
