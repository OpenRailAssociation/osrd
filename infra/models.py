from django.db import models


class Infra(models.Model):
    name = models.CharField(max_length=128)
    owner = models.UUIDField()
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Timetable(models.Model):
    infra = models.ForeignKey('Infra', on_delete=models.DO_NOTHING)


class SimulationParameter(models.Model):
    pass


class Simulation(models.Model):
    infra = models.ForeignKey('Infra', on_delete=models.DO_NOTHING)
    timetable = models.ForeignKey('Timetable', on_delete=models.DO_NOTHING)
    params = models.ForeignKey('SimulationParameter', on_delete=models.DO_NOTHING)
    start_time = models.DateTimeField(auto_now_add=True)
    started_by = models.UUIDField()


class RollingStock(models.Model):
    pass


