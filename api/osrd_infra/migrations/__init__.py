import enum
import itertools
from typing import Optional
import django
from django.db import migrations, models


def run_sql_complexe_add_foreign_key(table_name: str, field_name: str, model_name: str, link_model: str, link_table: str, nullable: bool = False):
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


def run_sql_add_foreign_key(model_name: str, field_name: str, link_model: str, nullable: bool = False):
    return run_sql_complexe_add_foreign_key(
        table_name=model_name,
        field_name=field_name,
        model_name=model_name,
        link_model=link_model,
        link_table=link_model,
        nullable=nullable
    )


def run_sql_add_foreign_key_infra(model_name: str):
    return run_sql_add_foreign_key(model_name, "infra", "infra")


class SearchTableType(enum.Enum):
    VIEW = enum.auto()
    MATERIALIZED_VIEW = enum.auto()
    TABLE = enum.auto()


RESULT_COLUMN_NAME = "result"


def run_sql_create_infra_search_table(
    name: str,
    source_table: str,
    columns: dict[str, str],
    result: str,
    *,
    table_type: SearchTableType = SearchTableType.VIEW,
    phony_model_name: Optional[str] = None,
    query_continuation: str = "",
    extra_columns: Optional[dict[str, str]] = None,
) -> migrations.RunSQL:
    """Creates a migration that setup a table optimized for searching.

    Example:

    ```
    run_sql_create_infra_search_table(
        name="my_search",
        source_table="clients",
        columns={
            "fn": "first_name",
            "ln": "last_name",
            "full_name": "first_name || ' ' || last_name"
        },
        extra_columns={"non_indexed_column", "NULL"},
        result="'Found client ' || first_name || ' ' || last_name"
    )
    ```

    Will create a view named `my_search` getting its data from the schema `clients` with:

    - 3 columns indexed for optimized searching: fn, ln and full_name.
      Their value correspond the evaluated SQL expression in the `column` dict.
    - An extra column `non_indexed_search` which is not meant for text searching
    - A `result` (fixed name) column with custom relevant data.
    """
    if table_type is SearchTableType.TABLE:
        raise NotImplementedError(SearchTableType.TABLE)
    if RESULT_COLUMN_NAME in columns:
        raise ValueError(f"reserved column name: '{RESULT_COLUMN_NAME}'")
    # Defaults to the view's name camel case-d
    phony_model_name = phony_model_name or name.replace("_", " ").title().replace(" ", "")
    view = "MATERIALIZED VIEW" if table_type is SearchTableType.MATERIALIZED_VIEW else "VIEW"
    extra_columns = extra_columns or {}
    select = ", ".join(
        itertools.chain(
            (f"osrd_prepare_for_search(({sql})) AS {col}" for col, sql in columns.items()),
            (f"({sql}) AS {col}" for col, sql in extra_columns.items()),
        )
    )
    indexes = [f"idx_gin_{col}" for col in columns]
    create_indexes = ";\n".join(
        f"CREATE INDEX IF NOT EXISTS {idx} ON {name} USING GIN ({col} gin_trgm_ops)"
        for idx, col in zip(indexes, columns)
    )
    drop_indexes = ";\n".join(f"DROP INDEX IF EXISTS {idx}" for idx in indexes)
    table_sql = f"""CREATE {view} {name} AS (
        SELECT {select}, ({result})::jsonb AS {RESULT_COLUMN_NAME}
        FROM {source_table}
        {query_continuation}
    )"""
    print(table_sql)
    return migrations.RunSQL(
        sql=f"{table_sql};\n{create_indexes}",
        reverse_sql=f"DROP {view} {name};\n{drop_indexes}",
        # NOTE: we create a phony model as an indication for Django that the view exists.
        # That way Django knows when the migration has been applied and can reverse it.
        # Otherwise, DROP VIEW would never be run.
        state_operations=[migrations.CreateModel(name=phony_model_name, fields=[])],
    )
