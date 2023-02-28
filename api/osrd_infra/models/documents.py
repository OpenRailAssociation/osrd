from django.contrib.gis.db import models


class Document(models.Model):
    content_type = models.CharField(max_length=255)
    data = models.BinaryField(editable=True)
