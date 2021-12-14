# Generated by Django 3.2.9 on 2021-12-14 09:33

import django.contrib.gis.db.models.fields
from django.db import migrations, models
import django.db.models.deletion
import osrd_infra.utils


class Migration(migrations.Migration):

    dependencies = [
        ('osrd_infra', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PathModel',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('owner', models.UUIDField(default='00000000-0000-0000-0000-000000000000', editable=False)),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('payload', models.JSONField(validators=[osrd_infra.utils.JSONSchemaValidator(limit_value={'definitions': {'Direction': {'description': 'An enumeration.', 'enum': ['START_TO_STOP', 'STOP_TO_START'], 'title': 'Direction', 'type': 'string'}, 'DirectionalTrackRange': {'properties': {'begin': {'title': 'Begin', 'type': 'number'}, 'direction': {'$ref': '#/definitions/Direction'}, 'end': {'title': 'End', 'type': 'number'}, 'track': {'$ref': '#/definitions/ObjectReference'}}, 'required': ['track', 'begin', 'end', 'direction'], 'title': 'DirectionalTrackRange', 'type': 'object'}, 'ObjectReference': {'properties': {'id': {'maxLength': 255, 'title': 'Id', 'type': 'string'}, 'type': {'title': 'Type', 'type': 'string'}}, 'required': ['id', 'type'], 'title': 'ObjectReference', 'type': 'object'}, 'PathStep': {'properties': {'route': {'$ref': '#/definitions/ObjectReference'}, 'track_sections': {'items': {'$ref': '#/definitions/DirectionalTrackRange'}, 'title': 'Track Sections', 'type': 'array'}}, 'required': ['route', 'track_sections'], 'title': 'PathStep', 'type': 'object'}, 'Point': {'description': 'Point Model', 'properties': {'coordinates': {'anyOf': [{'items': [{'anyOf': [{'type': 'number'}, {'type': 'integer'}]}, {'anyOf': [{'type': 'number'}, {'type': 'integer'}]}], 'type': 'array'}, {'items': [{'anyOf': [{'type': 'number'}, {'type': 'integer'}]}, {'anyOf': [{'type': 'number'}, {'type': 'integer'}]}, {'anyOf': [{'type': 'number'}, {'type': 'integer'}]}], 'type': 'array'}], 'title': 'Coordinates'}, 'type': {'const': 'Point', 'title': 'Type', 'type': 'string'}}, 'required': ['coordinates'], 'title': 'Point', 'type': 'object'}, 'Step': {'properties': {'geo': {'$ref': '#/definitions/Point'}, 'name': {'title': 'Name', 'type': 'string'}, 'position': {'title': 'Position', 'type': 'number'}, 'sch': {'$ref': '#/definitions/Point'}, 'stop_time': {'title': 'Stop Time', 'type': 'number'}, 'suggestion': {'title': 'Suggestion', 'type': 'boolean'}, 'track': {'$ref': '#/definitions/ObjectReference'}}, 'required': ['track', 'position', 'geo', 'sch', 'name', 'suggestion', 'stop_time'], 'title': 'Step', 'type': 'object'}}, 'properties': {'path': {'items': {'$ref': '#/definitions/PathStep'}, 'title': 'Path', 'type': 'array'}, 'steps': {'items': {'$ref': '#/definitions/Step'}, 'title': 'Steps', 'type': 'array'}}, 'required': ['path', 'steps'], 'title': 'Path', 'type': 'object'})])),
                ('vmax', models.JSONField(validators=[osrd_infra.utils.JSONSchemaValidator(limit_value={'definitions': {'VmaxPoint': {'properties': {'position': {'title': 'Position', 'type': 'number'}, 'speed': {'title': 'Speed', 'type': 'number'}}, 'required': ['position', 'speed'], 'title': 'VmaxPoint', 'type': 'object'}}, 'items': {'$ref': '#/definitions/VmaxPoint'}, 'title': 'Vmax', 'type': 'array'})])),
                ('slopes', models.JSONField(validators=[osrd_infra.utils.JSONSchemaValidator(limit_value={'definitions': {'SlopePoint': {'properties': {'gradient': {'title': 'Gradient', 'type': 'number'}, 'position': {'title': 'Position', 'type': 'number'}}, 'required': ['position', 'gradient'], 'title': 'SlopePoint', 'type': 'object'}}, 'items': {'$ref': '#/definitions/SlopePoint'}, 'title': 'Slope', 'type': 'array'})])),
                ('curves', models.JSONField(validators=[osrd_infra.utils.JSONSchemaValidator(limit_value={'definitions': {'CurvePoint': {'properties': {'position': {'title': 'Position', 'type': 'number'}, 'radius': {'title': 'Radius', 'type': 'number'}}, 'required': ['position', 'radius'], 'title': 'CurvePoint', 'type': 'object'}}, 'items': {'$ref': '#/definitions/CurvePoint'}, 'title': 'Curve', 'type': 'array'})])),
                ('geographic', django.contrib.gis.db.models.fields.LineStringField(srid=3857)),
                ('schematic', django.contrib.gis.db.models.fields.LineStringField(srid=3857)),
                ('infra', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='osrd_infra.infra')),
            ],
            options={
                'verbose_name_plural': 'paths',
            },
        ),
        migrations.AlterField(
            model_name='trainschedule',
            name='path',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='osrd_infra.pathmodel'),
        ),
        migrations.DeleteModel(
            name='Path',
        ),
    ]
