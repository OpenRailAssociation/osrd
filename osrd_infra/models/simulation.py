from django.contrib.gis.db import models
from osrd_infra.models.infra import Infra

class Timetable(models.Model):
    infra = models.ForeignKey('Infra', on_delete=models.DO_NOTHING)


class Simulation(models.Model):
    infra = models.ForeignKey('Infra', on_delete=models.DO_NOTHING)
    timetable = models.ForeignKey('Timetable', on_delete=models.DO_NOTHING)
    start_time = models.DateTimeField(auto_now_add=True)
    started_by = models.UUIDField()


class RollingStock(models.Model):
    pass
