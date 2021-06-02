from django.contrib.gis.db import models
from osrd_infra.models.infra import Infra
from osrd_infra.models.rolling_stock import RollingStock
from osrd_infra.models.pathfinding import Path


class Timetable(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.DO_NOTHING)
    name = models.CharField(max_length=128)


class TrainSchedule(models.Model):
    train_id = models.CharField(max_length=128)
    timetable = models.ForeignKey(Timetable, on_delete=models.CASCADE, related_name="train_schedules")
    rolling_stock = models.ForeignKey(RollingStock, on_delete=models.DO_NOTHING)
    departure_time = models.FloatField()
    path = models.ForeignKey(Path, on_delete=models.CASCADE)
    phases = models.JSONField()
    initial_speed = models.FloatField()


class Simulation(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.DO_NOTHING)
    timetable = models.ForeignKey(Timetable, on_delete=models.DO_NOTHING)
    start_time = models.DateTimeField(auto_now_add=True)
    started_by = models.UUIDField()
