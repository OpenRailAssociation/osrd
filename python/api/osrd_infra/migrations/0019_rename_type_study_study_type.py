# Generated by Django 4.1.5 on 2023-03-15 10:12

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("osrd_infra", "0018_alter_rollingstocklivery_compound_image"),
    ]

    operations = [
        migrations.RenameField(
            model_name="study",
            old_name="type",
            new_name="study_type",
        ),
    ]
