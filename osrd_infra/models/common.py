from django.db import models
from rest_framework import serializers


class EnumSerializer(serializers.Field):
    __slots__ = ("enum",)

    def __init__(self, enum: models.IntegerChoices, *args, **kwargs):
        self.enum = enum
        super().__init__(*args, **kwargs)

    def to_representation(self, value):
        return self.enum.names[value]

    def to_internal_value(self, data):
        return self.enum[data].value
