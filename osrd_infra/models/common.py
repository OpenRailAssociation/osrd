from django.db import models


class Endpoint(models.IntegerChoices):
    BEGIN = 0
    END = 1


def EndpointField():
    return models.IntegerField(choices=Endpoint.choices)
