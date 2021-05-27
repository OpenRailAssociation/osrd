from django.contrib.gis.db import models
from osrd_infra.models import EntityNamespace


class Path(models.Model):
    name = models.CharField(max_length=128, blank=False)
    owner = models.UUIDField(
        editable=False, default="00000000-0000-0000-0000-000000000000"
    )
    namespace = models.ForeignKey(
        EntityNamespace, on_delete=models.CASCADE, editable=False
    )
    created = models.DateTimeField(editable=False, auto_now_add=True)
    payload = models.JSONField()

    def __str__(self):
        return self.name
