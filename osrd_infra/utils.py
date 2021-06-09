import jsonschema
from django.core.validators import BaseValidator
from rest_framework.exceptions import ValidationError


class JSONSchemaValidator(BaseValidator):
    def compare(self, data, schema):
        try:
            jsonschema.validate(data, schema)
        except jsonschema.exceptions.ValidationError as e:
            raise ValidationError(e.message, code="invalid")
