from django.contrib.gis.db import models

from osrd_infra.models import PathModel, RollingStock, Timetable
from osrd_infra.schemas.train_schedule import MRPS, Allowances, TrainScheduleLabels
from osrd_infra.utils import PydanticValidator


class TrainScheduleModel(models.Model):
    train_name = models.CharField(max_length=128)
    timetable = models.ForeignKey(Timetable, on_delete=models.CASCADE, related_name="train_schedules")
    rolling_stock = models.ForeignKey(RollingStock, on_delete=models.CASCADE)
    departure_time = models.FloatField()
    path = models.ForeignKey(PathModel, on_delete=models.CASCADE)
    initial_speed = models.FloatField()
    labels = models.JSONField(default=[], validators=[PydanticValidator(TrainScheduleLabels)])
    allowances = models.JSONField(default=[], validators=[PydanticValidator(Allowances)])
    mrsp = models.JSONField(validators=[PydanticValidator(MRPS)])
    base_simulation = models.JSONField()
    eco_simulation = models.JSONField(null=True)
    speed_limit_category = models.CharField(max_length=128)
