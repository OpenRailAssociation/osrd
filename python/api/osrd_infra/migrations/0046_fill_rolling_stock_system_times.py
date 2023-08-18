from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("osrd_infra", "0045_railjson_3_4_0"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                update
                    osrd_infra_rollingstock as rs
                set
                    electrical_power_startup_time = 5.0,
                    raise_pantograph_time = 15.0
                where 
                    (rs.electrical_power_startup_time is null or rs.raise_pantograph_time is null)
                    and exists (
                        select
                            1
                        from
                            jsonb_each(rs.effort_curves->'modes') as m
                        where
                            (m.value->'is_electric')::boolean
                    )
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
