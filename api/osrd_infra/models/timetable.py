from django.contrib.gis.db import models

from osrd_infra.models import Infra


class Timetable(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.CASCADE)
    name = models.CharField(max_length=128)
