from django.contrib.gis.db import models
from osrd_schemas.rolling_stock import ComfortType
from osrd_schemas.train_schedule import (
    MRSP,
    Allowances,
    TrainScheduleLabels,
    TrainScheduleOptions,
)

from osrd_infra.models import PathModel, RollingStock, Timetable
from osrd_infra.utils import PydanticValidator


class TrainScheduleModel(models.Model):
    train_name = models.CharField(max_length=128)
    labels = models.JSONField(default=list, validators=[PydanticValidator(TrainScheduleLabels)])
    timetable = models.ForeignKey(Timetable, on_delete=models.CASCADE, related_name="train_schedules")

    # Simulation inputs
    rolling_stock = models.ForeignKey(RollingStock, on_delete=models.CASCADE)
    departure_time = models.FloatField()
    path = models.ForeignKey(PathModel, on_delete=models.CASCADE)
    initial_speed = models.FloatField()
    allowances = models.JSONField(default=list, validators=[PydanticValidator(Allowances)])
    comfort = models.CharField(
        max_length=8, choices=[(x.value, x.name) for x in ComfortType], default=ComfortType.STANDARD
    )
    speed_limit_tags = models.CharField(max_length=128, null=True)
    options = models.JSONField(null=True, blank=True, validators=[PydanticValidator(TrainScheduleOptions)])

    # Simulation outputs
    mrsp = models.JSONField(validators=[PydanticValidator(MRSP)])
    base_simulation = models.JSONField()
    eco_simulation = models.JSONField(null=True)
    modes_and_profiles = models.JSONField(default=list)
