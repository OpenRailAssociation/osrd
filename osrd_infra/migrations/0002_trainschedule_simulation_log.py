from django.db import migrations, models


def copy_train_schedule_result(apps, schema_editor):
    TrainSchedule = apps.get_model("osrd_infra", "TrainSchedule")
    TrainScheduleResult = apps.get_model("osrd_infra", "TrainScheduleResult")
    for result in TrainScheduleResult.objects.prefetch_related("train_schedule"):
        schedule = result.train_schedule
        schedule.simulation_log = result.log
        schedule.save()


class Migration(migrations.Migration):

    dependencies = [
        ('osrd_infra', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='trainschedule',
            name='simulation_log',
            field=models.JSONField(null=True),
        ),
        migrations.RunPython(
            copy_train_schedule_result
        ),
        migrations.DeleteModel(
            name='TrainScheduleResult',
        ),
    ]
