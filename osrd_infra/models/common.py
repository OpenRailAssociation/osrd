from django.db import models
from dataclasses import dataclass
from rest_framework import serializers


class Endpoint(models.IntegerChoices):
    BEGIN = 0
    END = 1


def EndpointField():
    return models.IntegerField(choices=Endpoint.choices)


class EnumSerializer(serializers.Field):
    __slots__ = ("enum",)

    def __init__(self, enum: models.IntegerChoices, *args, **kwargs):
        self.enum = enum
        super().__init__(*args, **kwargs)

    def to_representation(self, value):
        return self.enum.names[value]

    def to_internal_value(self, data):
        return self.enum[data].value
