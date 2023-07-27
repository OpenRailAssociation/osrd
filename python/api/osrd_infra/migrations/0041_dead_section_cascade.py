from django.db import migrations, models


def make_col_delete_cascade(model_name):
    return migrations.RunSQL(
        sql=[
            (
                f"""ALTER TABLE osrd_infra_{model_name}
            DROP CONSTRAINT osrd_infra_{model_name}_pkey,
            ADD CONSTRAINT osrd_infra_{model_name}_pkey
            FOREIGN KEY (infra_id)
            REFERENCES osrd_infra_infra(id)
            ON DELETE CASCADE
            """
            )
        ],
        reverse_sql=f"""ALTER TABLE osrd_infra_{model_name}
            DROP CONSTRAINT osrd_infra_{model_name}_pkey,
            ADD CONSTRAINT osrd_infra_{model_name}_pkey
            FOREIGN KEY (infra_id)
            REFERENCES osrd_infra_infra(id)
            """,
        state_operations=[
            migrations.AlterField(
                model_name=model_name,
                name="infra",
                field=models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    to="osrd_infra.infra",
                ),
            ),
        ],
    )


class Migration(migrations.Migration):
    dependencies = [
        ("osrd_infra", "0040_trainschedule_infra_version_and_more"),
    ]

    operations = [
        make_col_delete_cascade("deadsectionmodel"),
        make_col_delete_cascade("deadsectionlayer"),
        make_col_delete_cascade("backsidepantographdeadsectionlayer"),
    ]
