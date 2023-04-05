from django.contrib.gis.db import models
from osrd_schemas.train_schedule import MRSP

from osrd_infra.utils import PydanticValidator

from .train_schedule import TrainSchedule


class SimulationOutput(models.Model):
    mrsp = models.JSONField(validators=[PydanticValidator(MRSP)])
    base_simulation = models.JSONField()
    eco_simulation = models.JSONField(null=True)
    electrification_conditions = models.JSONField(default=list)
    train_schedule = models.OneToOneField(TrainSchedule, on_delete=models.CASCADE, related_name="simulation_output")
