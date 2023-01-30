# Generated by Django 4.1.5 on 2023-01-24 14:04

import django.contrib.postgres.fields
import django.db.models.deletion
from django.db import migrations, models

from osrd_infra.migrations import run_sql_add_foreign_key


class Migration(migrations.Migration):

    dependencies = [
        ("osrd_infra", "0003_rollingstockimages"),
    ]

    operations = [
        migrations.CreateModel(
            name="Study",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=128)),
                ("description", models.CharField(max_length=1024, blank=True, default="")),
                ("business_code", models.CharField(max_length=128, blank=True, default="")),
                ("service_code", models.CharField(max_length=128, blank=True, default="")),
                ("creation_date", models.DateTimeField(auto_now_add=True)),
                ("last_modification", models.DateTimeField(auto_now=True)),
                ("start_date", models.DateTimeField(null=True, blank=True)),
                ("expected_end_date", models.DateTimeField(null=True, blank=True)),
                ("actual_end_date", models.DateTimeField(null=True, blank=True)),
                ("budget", models.IntegerField(null=True, blank=True)),
                (
                    "tags",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.CharField(max_length=255), blank=True, null=True, size=None
                    ),
                ),
                (
                    "state",
                    models.CharField(
                        blank=True,
                        choices=[("started", "Started"), ("inProgress", "InProgress"), ("finish", "Finish")],
                        default="",
                        max_length=16,
                    ),
                ),
                (
                    "type",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("timeTables", "TimeTable"),
                            ("flowRate", "FlowRate"),
                            ("parkSizing", "ParkSizing"),
                            ("garageRequirement", "GarageRequirement"),
                            ("operationOrSizing", "OperationOrSizing"),
                            ("operability", "Operability"),
                            ("strategicPlanning", "StrategicPlanning"),
                            ("chartStability", "ChartStability"),
                            ("disturbanceTests", "Disturbance"),
                        ],
                        default="",
                        max_length=100,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Project",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=128)),
                ("objectives", models.CharField(max_length=4096, blank=True, default="")),
                ("description", models.CharField(max_length=1024, blank=True, default="")),
                (
                    "funders",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.CharField(max_length=255), null=True, blank=True, size=None
                    ),
                ),
                ("budget", models.IntegerField(blank=True, null=True)),
                ("image", models.BinaryField(editable=True, blank=True, null=True)),
                ("creation_date", models.DateTimeField(auto_now_add=True)),
                ("last_modification", models.DateTimeField(auto_now=True)),
                (
                    "tags",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.CharField(max_length=255), blank=True, null=True, size=None
                    ),
                ),
            ],
        ),
        migrations.RemoveField(
            model_name="timetable",
            name="infra",
        ),
        migrations.CreateModel(
            name="Scenario",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=128)),
                ("description", models.CharField(blank=True, default="", max_length=1024)),
                ("creation_date", models.DateTimeField(auto_now_add=True)),
                ("last_modification", models.DateTimeField(auto_now=True)),
                (
                    "tags",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.CharField(max_length=255), blank=True, null=True, size=None
                    ),
                ),
                (
                    "infra",
                    models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to="osrd_infra.infra"),
                ),
                (
                    "timetable",
                    models.OneToOneField(
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="scenario",
                        to="osrd_infra.timetable",
                    ),
                ),
            ],
        ),
        run_sql_add_foreign_key("scenario", "study", "study", related_name="scenarios"),
        run_sql_add_foreign_key("study", "project", "project", related_name="studies"),
    ]
