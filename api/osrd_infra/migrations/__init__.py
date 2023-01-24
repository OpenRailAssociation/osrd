import django
from django.db import migrations, models


def run_sql_add_foreign_key(model_name: str, field_name: str, link_model: str, nullable: bool = False):
    return migrations.RunSQL(
        f"""ALTER TABLE osrd_infra_{model_name}
                ADD {field_name}_id INTEGER {"NULL" if nullable else ""},
                ADD CONSTRAINT osrd_{link_model}_{model_name}_fkey FOREIGN KEY ({field_name}_id)
                   REFERENCES osrd_infra_{link_model}(id) ON DELETE CASCADE
            """,
        state_operations=[
            migrations.AddField(
                model_name=model_name,
                name=field_name,
                field=models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to=f"osrd_infra.{link_model}",
                    null=nullable,
                    blank=nullable,
                ),
            ),
        ],
    )


def run_sql_add_foreign_key_infra(model_name: str):
    return run_sql_add_foreign_key(model_name, "infra", "infra")
