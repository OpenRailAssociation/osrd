from django.contrib.gis.db import models
from osrd_infra.models.infra import Infra
from osrd_infra.models.rolling_stock import RollingStock
from osrd_infra.models.pathfinding import Path


class Timetable(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.DO_NOTHING)
    name = models.CharField(max_length=128)


class TrainSchedule(models.Model):
    train_name = models.CharField(max_length=128)
    timetable = models.ForeignKey(
        Timetable, on_delete=models.CASCADE, related_name="train_schedules"
    )
    rolling_stock = models.ForeignKey(RollingStock, on_delete=models.DO_NOTHING)
    departure_time = models.FloatField()
    path = models.ForeignKey(Path, on_delete=models.CASCADE)
    initial_speed = models.FloatField()
    labels = models.ManyToManyField("TrainScheduleLabel", blank=True)


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


class TrainScheduleLabel(models.Model):
    label = models.CharField(max_length=128, unique=True)
