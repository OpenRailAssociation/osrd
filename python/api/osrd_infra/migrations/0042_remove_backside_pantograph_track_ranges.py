# Generated by Django 4.1.5 on 2023-08-01 09:59

from django.db import migrations, models


def remove_backside_panto_field(apps, schema_editor):
    DeadSection = apps.get_model("osrd_infra", "DeadSectionModel")
    for dead_section in DeadSection.objects.all():
        dead_section.data.pop("backside_pantograph_track_ranges", None)
        dead_section.save()


def add_backside_panto_field(apps, schema_editor):
    DeadSection = apps.get_model("osrd_infra", "DeadSectionModel")
    for dead_section in DeadSection.objects.all():
        dead_section.data["backside_pantograph_track_ranges"] = []
        dead_section.save()


class Migration(migrations.Migration):

    dependencies = [
        ("osrd_infra", "0041_dead_section_cascade"),
    ]

    operations = [
        migrations.AlterField(
            model_name="infra",
            name="railjson_version",
            field=models.CharField(default="3.4.0", editable=False, max_length=16),
        ),
        migrations.DeleteModel(
            name="BacksidePantographDeadSectionLayer",
        ),
        migrations.RunPython(
            code=remove_backside_panto_field,
            reverse_code=add_backside_panto_field,
        ),
    ]
