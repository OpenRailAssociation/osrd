from django.contrib.gis.db import models
from osrd_infra.utils import PydanticValidator

from osrd_infra.schemas.external_generated_inputs import ElectricalProfileSet as ElectricalProfileSetSchema


class ElectricalProfileSetManager(models.Manager):
    use_for_related_fields = True

    def get_queryset(self, *args, **kwargs):
        return super().get_queryset(*args, **kwargs).defer("data")


class ElectricalProfileSet(models.Model):
    """A set of electrical profiles, which model the power loss along the catenaries of an infra."""

    name = models.CharField(max_length=128)
    data = models.JSONField(validators=[PydanticValidator(ElectricalProfileSetSchema)])

    objects = ElectricalProfileSetManager()

    class Meta:
        verbose_name_plural = "Electrical profile sets"
        base_manager_name = "objects"
