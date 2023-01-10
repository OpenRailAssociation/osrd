from django.contrib.gis.db import models
from osrd_infra.utils import PydanticValidator

from osrd_infra.schemas.physical_approximations import ElectricalProfilesList


class ElectricalProfilesSet(models.Model):
    name = models.CharField(max_length=128)
    data = models.JSONField(validators=[PydanticValidator(ElectricalProfilesList)])

    class Meta:
        verbose_name_plural = "Electrical profiles sets"
