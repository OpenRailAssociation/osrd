# Generated by Django 3.2.9 on 2021-12-01 12:40

from django.db import migrations, models
import osrd_infra.utils


class Migration(migrations.Migration):

    dependencies = [
        ('osrd_infra', '0013_path_vmax'),
    ]

    operations = [
        migrations.AddField(
            model_name='path',
            name='curves',
            field=models.JSONField(default=[], validators=[osrd_infra.utils.JSONSchemaValidator(limit_value={'items': {'additionalProperties': False, 'properties': {'position': {'type': 'number'}, 'radius': {'type': 'number'}}, 'required': ['position', 'radius'], 'type': 'object'}, 'minItems': 2, 'type': 'array'})]),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='path',
            name='slopes',
            field=models.JSONField(default=[], validators=[osrd_infra.utils.JSONSchemaValidator(limit_value={'items': {'additionalProperties': False, 'properties': {'gradient': {'type': 'number'}, 'position': {'type': 'number'}}, 'required': ['position', 'gradient'], 'type': 'object'}, 'minItems': 2, 'type': 'array'})]),
            preserve_default=False,
        ),
    ]
