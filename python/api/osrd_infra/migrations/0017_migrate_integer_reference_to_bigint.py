from django.db import migrations


def alter_field_to_int8(model_name: str, column_name: str) -> str:
    return f"ALTER TABLE public.osrd_infra_{model_name} ALTER COLUMN {column_name} TYPE int8 USING {column_name}::int8;"


class Migration(migrations.Migration):
    dependencies = [
        ("osrd_infra", "0016_osrd_search_track"),
    ]

    operations = [
        migrations.RunSQL(
            sql="\n".join(
                alter_field_to_int8(model_name, column_name)
                for model_name, column_name in [
                    ("bufferstoplayer", "infra_id"),
                    ("bufferstopmodel", "infra_id"),
                    ("catenarylayer", "infra_id"),
                    ("catenarymodel", "infra_id"),
                    ("detectorlayer", "infra_id"),
                    ("detectormodel", "infra_id"),
                    ("lpvpanellayer", "infra_id"),
                    ("operationalpointlayer", "infra_id"),
                    ("operationalpointmodel", "infra_id"),
                    ("routemodel", "infra_id"),
                    ("signallayer", "infra_id"),
                    ("signalmodel", "infra_id"),
                    ("speedsectionlayer", "infra_id"),
                    ("speedsectionmodel", "infra_id"),
                    ("switchlayer", "infra_id"),
                    ("switchmodel", "infra_id"),
                    ("switchtypemodel", "infra_id"),
                    ("tracksectionlayer", "infra_id"),
                    ("tracksectionlinklayer", "infra_id"),
                    ("tracksectionlinkmodel", "infra_id"),
                    ("tracksectionmodel", "infra_id"),
                    ("pathmodel", "infra_id"),
                    ("trainschedule", "path_id"),
                    ("trainschedule", "timetable_id"),
                    ("trainschedule", "rolling_stock_id"),
                    ("rollingstocklivery", "rolling_stock_id"),
                    ("rollingstocklivery", "compound_image_id"),
                    ("scenario", "infra_id"),
                    ("scenario", "timetable_id"),
                    ("scenario", "study_id"),
                    ("scenario", "electrical_profile_set_id"),
                    ("rollingstockimage", "livery_id"),
                    ("simulationoutput", "train_schedule_id"),
                    ("study", "project_id"),
                    ("project", "image_id"),
                ]
            ),
        ),
    ]
