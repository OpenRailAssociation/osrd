from typing import List

from django.contrib.gis.db import models
from pydantic import BaseModel, constr

from osrd_infra.models import Infra, PathModel, RollingStock
from osrd_infra.utils import JSONSchemaValidator

MARGINS_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "required": ["type", "value"],
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


class TrainScheduleLabels(BaseModel):
    __root__: List[constr(max_length=128)]


class TrainSchedule(models.Model):
    train_name = models.CharField(max_length=128)
    timetable = models.ForeignKey(Timetable, on_delete=models.CASCADE, related_name="train_schedules")
    rolling_stock = models.ForeignKey(RollingStock, on_delete=models.CASCADE)
    departure_time = models.FloatField()
    path = models.ForeignKey(PathModel, on_delete=models.CASCADE)
    initial_speed = models.FloatField()
    labels = models.JSONField(default=[], validators=[JSONSchemaValidator(limit_value=TrainScheduleLabels.schema())])
    margins = models.JSONField(default=[], validators=[JSONSchemaValidator(limit_value=MARGINS_SCHEMA)])
    base_simulation = models.JSONField()
    eco_simulation = models.JSONField(null=True)


class Simulation(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.DO_NOTHING)
    timetable = models.ForeignKey(Timetable, on_delete=models.DO_NOTHING)
    start_time = models.DateTimeField(auto_now_add=True)
    started_by = models.UUIDField()
