from django.contrib.gis.db import models

from osrd_infra.models import ElectricalProfileSet


class Timetable(models.Model):
    electrical_profile_set = models.ForeignKey(ElectricalProfileSet, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=128)

    @property
    def infra(self):
        return self.scenario.infra
