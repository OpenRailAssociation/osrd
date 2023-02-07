from django.contrib.gis.db import models

from osrd_infra.models import ElectricalProfileSet, Infra


class Timetable(models.Model):
    name = models.CharField(max_length=128)

    @property
    def infra(self) -> Infra:
        return self.scenario.infra

    @property
    def electrical_profile_set(self) -> ElectricalProfileSet:
        return self.scenario.electrical_profile_set
