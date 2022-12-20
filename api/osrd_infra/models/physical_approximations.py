from django.contrib.gis.db import models
from osrd_infra.utils import PydanticValidator

from osrd_infra.schemas.physical_approximations import ElectricProfilesList as ElectricProfilesListSchema


class ElectricProfilesList(models.Model):
    data = models.JSONField(validators=[PydanticValidator(ElectricProfilesListSchema)])

    class Meta:
        verbose_name_plural = "electric profiles lists"
