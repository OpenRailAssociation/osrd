import jsonschema
from django.core.validators import BaseValidator
from rest_framework.exceptions import ValidationError


class JSONSchemaValidator(BaseValidator):
    def compare(self, data, schema):
        try:
            jsonschema.validate(data, schema)
        except jsonschema.exceptions.ValidationError as e:
            raise ValidationError(e.message, code="invalid")


def geo_transform(gis_object):
    gis_object.transform(4326)
    return gis_object


def reverse_format(object_id):
    return int(object_id.split(".")[1])
