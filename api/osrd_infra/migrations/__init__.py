import django
from django.db import migrations, models


def run_sql_complexe_add_foreign_key(table_name: str, field_name: str, model_name: str, link_model: str,
                                     link_table: str, nullable: bool = False, related_name: str = ""):
    if related_name:
        field = models.ForeignKey(
            on_delete=django.db.models.deletion.CASCADE,
            to=f"osrd_infra.{link_model}",
            related_name=related_name,
            null=nullable,
            blank=nullable,
        )
    else:
        field = models.ForeignKey(
            on_delete=django.db.models.deletion.CASCADE,
            to=f"osrd_infra.{link_model}",
            null=nullable,
            blank=nullable,
        )

    return migrations.RunSQL(
        sql=[(f"""ALTER TABLE osrd_infra_{table_name}
                ADD {field_name}_id INTEGER {"NULL" if nullable else ""},
                ADD CONSTRAINT osrd_{link_model}_{model_name}_fkey FOREIGN KEY ({field_name}_id)
                   REFERENCES osrd_infra_{link_table}(id) ON DELETE CASCADE
            """)],
        reverse_sql=[(f"""ALTER TABLE osrd_infra_{table_name}
                DROP CONSTRAINT osrd_{link_model}_{model_name}_fkey,
                DROP COLUMN {field_name}_id
            """)],
        state_operations=[
            migrations.AddField(model_name=model_name, name=field_name, field=field),
        ],
    )


def run_sql_add_foreign_key(model_name: str, field_name: str, link_model: str, nullable: bool = False,
                            related_name: str = ""):
    return run_sql_complexe_add_foreign_key(
        table_name=model_name,
        field_name=field_name,
        model_name=model_name,
        link_model=link_model,
        link_table=link_model,
        nullable=nullable,
        related_name=related_name
    )


def run_sql_add_foreign_key_infra(model_name: str):
    return run_sql_add_foreign_key(model_name, "infra", "infra")


def run_sql_add_one_to_one_key(model_name: str, field_name: str, link_model: str, related_name: str):
    return migrations.RunSQL(
        f"""ALTER TABLE osrd_infra_{model_name}
                ADD {field_name}_id INTEGER,
                ADD CONSTRAINT osrd_{link_model}_{model_name}_fkey FOREIGN KEY ({field_name}_id)
                        REFERENCES osrd_infra_{link_model}(id) ON DELETE CASCADE,
                ADD CONSTRAINT osrd_infra_{field_name}_id_uniq UNIQUE ({field_name}_id)
            """,
        state_operations=[
            migrations.AddField(
                model_name=model_name,
                name=field_name,
                field=models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name=related_name,
                    to=f"osrd_infra.{link_model}",
                ),
            ),
        ],
    )
