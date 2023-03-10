from django.contrib.gis.db import models
from django.contrib.postgres.fields import ArrayField
from osrd_schemas.study import StudyState, StudyType

from osrd_infra.models.electrical_profiles import ElectricalProfileSet
from osrd_infra.models.infra import Infra
from osrd_infra.models.timetable import Timetable


class Project(models.Model):
    name = models.CharField(max_length=128)
    objectives = models.CharField(max_length=4096, blank=True, default="")
    description = models.CharField(max_length=1024, blank=True, default="")
    funders = ArrayField(models.CharField(max_length=255), blank=True, null=True)
    budget = models.IntegerField(blank=True, null=True)
    image = models.BinaryField(null=True, blank=True, editable=True)
    creation_date = models.DateTimeField(editable=False, auto_now_add=True)
    last_modification = models.DateTimeField(auto_now=True)
    tags = ArrayField(models.CharField(max_length=255), blank=True, null=True)


class Study(models.Model):
    project = models.ForeignKey(Project, related_name="studies", on_delete=models.CASCADE)
    name = models.CharField(max_length=128)
    description = models.CharField(max_length=1024, blank=True, default="")
    business_code = models.CharField(max_length=128, blank=True, default="")
    service_code = models.CharField(max_length=128, blank=True, default="")
    creation_date = models.DateTimeField(editable=False, auto_now_add=True)
    last_modification = models.DateTimeField(auto_now=True)
    start_date = models.DateTimeField(blank=True, null=True)
    expected_end_date = models.DateTimeField(blank=True, null=True)
    actual_end_date = models.DateTimeField(blank=True, null=True)
    budget = models.IntegerField(blank=True, null=True)
    tags = ArrayField(models.CharField(max_length=255), blank=True, null=True)
    state = models.CharField(max_length=16, choices=[(x.value, x.name) for x in StudyState], blank=True, default="")
    type = models.CharField(max_length=100, choices=[(x.value, x.name) for x in StudyType], blank=True, default="")


class Scenario(models.Model):
    study = models.ForeignKey(Study, related_name="scenarios", on_delete=models.CASCADE, null=False)
    name = models.CharField(max_length=128)
    description = models.CharField(max_length=1024, blank=True, default="")
    infra = models.ForeignKey(Infra, on_delete=models.SET_NULL, null=True)
    electrical_profile_set = models.ForeignKey(ElectricalProfileSet, on_delete=models.CASCADE, null=True, blank=True)
    creation_date = models.DateTimeField(
        editable=False,
        auto_now_add=True,
    )
    timetable = models.OneToOneField(Timetable, related_name="scenario", on_delete=models.CASCADE, null=True)
    last_modification = models.DateTimeField(auto_now=True)
    tags = ArrayField(models.CharField(max_length=255), blank=True, null=True)

    def delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)
        if self.timetable:
            self.timetable.delete()
