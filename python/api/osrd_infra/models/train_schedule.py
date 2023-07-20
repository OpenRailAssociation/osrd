from django.contrib.gis.db import models
from osrd_schemas.rolling_stock import ComfortType
from osrd_schemas.train_schedule import (
    Allowances,
    PowerRestrictionRanges,
    ScheduledPoints,
    TrainScheduleLabels,
    TrainScheduleOptions,
)

from osrd_infra.utils import PydanticValidator

from .path import PathModel
from .rolling_stock import RollingStock
from .timetable import Timetable


class TrainSchedule(models.Model):
    train_name = models.CharField(max_length=128)
    labels = models.JSONField(default=list, validators=[PydanticValidator(TrainScheduleLabels)])
    timetable = models.ForeignKey(Timetable, on_delete=models.CASCADE, related_name="train_schedules")

    rolling_stock = models.ForeignKey(RollingStock, on_delete=models.CASCADE)
    departure_time = models.FloatField()
    path = models.ForeignKey(PathModel, on_delete=models.CASCADE)
    initial_speed = models.FloatField()
    allowances = models.JSONField(default=list, validators=[PydanticValidator(Allowances)])
    scheduled_points = models.JSONField(default=list, validators=[PydanticValidator(ScheduledPoints)])
    comfort = models.CharField(
        max_length=8, choices=[(x.value, x.name) for x in ComfortType], default=ComfortType.STANDARD
    )
    speed_limit_tags = models.CharField(max_length=128, null=True)
    power_restriction_ranges = models.JSONField(
        null=True, blank=True, validators=[PydanticValidator(PowerRestrictionRanges)]
    )
    options = models.JSONField(null=True, blank=True, validators=[PydanticValidator(TrainScheduleOptions)])
    infra_version = models.CharField(editable=False, max_length=40, default="1")
    rollingstock_version = models.BigIntegerField(editable=False, default=0)
