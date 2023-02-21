import enum
import itertools
import re
from typing import Optional

import django
from django.db import migrations, models


def run_sql_complex_add_foreign_key(
    table_name: str,
    field_name: str,
    model_name: str,
    link_model: str,
    link_table: str,
    nullable: bool = False,
    related_name: Optional[str] = None,
):

    field = models.ForeignKey(
        on_delete=django.db.models.deletion.CASCADE,
        to=f"osrd_infra.{link_model}",
        null=nullable,
        blank=nullable,
        related_name=related_name,
    )
    return migrations.RunSQL(
        sql=[
            (
                f"""ALTER TABLE osrd_infra_{table_name}
                ADD {field_name}_id INTEGER {"NULL" if nullable else ""},
                ADD CONSTRAINT osrd_{link_model}_{model_name}_fkey FOREIGN KEY ({field_name}_id)
                   REFERENCES osrd_infra_{link_table}(id) ON DELETE CASCADE
            """
            )
        ],
        reverse_sql=[
            (
                f"""ALTER TABLE osrd_infra_{table_name}
                DROP CONSTRAINT osrd_{link_model}_{model_name}_fkey,
                DROP COLUMN {field_name}_id
            """
            )
        ],
        state_operations=[
            migrations.AddField(model_name=model_name, name=field_name, field=field),
        ],
    )


def run_sql_add_foreign_key(
    model_name: str, field_name: str, link_model: str, nullable: bool = False, related_name: Optional[str] = None
):
    return run_sql_complex_add_foreign_key(
        table_name=model_name,
        field_name=field_name,
        model_name=model_name,
        link_model=link_model,
        link_table=link_model,
        nullable=nullable,
        related_name=related_name,
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


class SearchTableType(enum.Enum):
    VIEW = enum.auto()
    MATERIALIZED_VIEW = enum.auto()
    TABLE = enum.auto()


class SearchIndex(enum.Enum):
    GIN = ("gin", "GIN", "gin_trgm_ops")
    GIST = ("gist", "GIST", "gist_trgm_ops(siglen=32)")

    def create(self, column: str, table: str) -> str:
        prefix, method, opclass = self.value
        return f'CREATE INDEX IF NOT EXISTS "idx_{prefix}_{column}" ON "{table}" USING {method} ("{column}" {opclass})'

    def drop(self, column: str) -> str:
        prefix, _, __ = self.value
        return f'DROP INDEX IF EXISTS "idx_{prefix}_{column}"'


SEARCH_TABLE_REGEXP = re.compile(r"^[a-z_](\w|[_-])*$", re.IGNORECASE)
SEARCH_COLUMN_REGEXP = re.compile(r"^[a-z_](\w|[_-])*$", re.IGNORECASE)
SEARCH_RESERVED_COLUMNS_REGEXP = re.compile(r"^id$", re.IGNORECASE)

Sql = str


def insert_trigger(search_table: str, source_table: str, columns: dict[str, Sql], query_continuation: Sql) -> Sql:
    insert_columns = ", ".join(f'"{col}"' for col in columns)
    select_columns = ", ".join(f'({sql}) AS "{col}"' for col, sql in columns.items())
    trigger = f'"{search_table}__ins_trig"'
    proc = f'"{search_table}__ins_trig_fun"'
    return (
        f"""
        CREATE OR REPLACE FUNCTION {proc}()
            RETURNS TRIGGER
            LANGUAGE plpgsql
        AS $$
        BEGIN
            INSERT INTO "{search_table}" (id, {insert_columns})
                SELECT t.id AS id, {select_columns}
                FROM (SELECT NEW.*) AS t
                {query_continuation};
            RETURN NEW;
        END;
        $$;
        CREATE TRIGGER {trigger}
        AFTER INSERT
        ON "{source_table}"
        FOR EACH ROW
        EXECUTE FUNCTION {proc}();
    """.format(
            source="t"
        ),
        f"""DROP TRIGGER IF EXISTS {trigger} ON "{source_table}";
        DROP FUNCTION IF EXISTS {proc};
    """,
    )


def update_trigger(search_table: str, source_table: str, columns: dict[str, Sql], query_continuation: Sql) -> Sql:
    set_columns = ", ".join(f'"{col}" = ({sql})' for col, sql in columns.items())
    trigger = f'"{search_table}__upd_trig"'
    proc = f'"{search_table}__upd_trig_fun"'
    return (
        f"""
        CREATE OR REPLACE FUNCTION {proc}()
            RETURNS TRIGGER
            LANGUAGE plpgsql
        AS $$
        BEGIN
            UPDATE "{search_table}"
                SET {set_columns}
                FROM (SELECT NEW.*) AS t
                WHERE t.id = "{search_table}".id
                {query_continuation};
            RETURN NEW;
        END;
        $$;
        CREATE TRIGGER {trigger}
        AFTER UPDATE
        ON "{source_table}"
        FOR EACH ROW
        EXECUTE FUNCTION {proc}();
    """.format(
            source="t"
        ),
        f"""DROP TRIGGER IF EXISTS {trigger} ON "{source_table}";
        DROP FUNCTION IF EXISTS {proc};
    """,
    )


def run_sql_create_infra_search_table(
    name: str,
    source_table: Sql,
    search_columns: dict[str, Sql],
    *,
    extra_columns: Optional[dict[str, tuple[Sql, Sql]]] = None,
    table_type: SearchTableType = SearchTableType.TABLE,
    index: SearchIndex = SearchIndex.GIN,
    phony_model_name: Optional[str] = None,
    source_table_pk: str = "id",
    triggers: bool = False,
    create_table_continuation: Sql = "",
    query_continuation: Sql = "",
) -> migrations.RunSQL:
    """Creates a migration that setup a table optimized for searching.

    Example:

    ```
    run_sql_create_infra_search_table(
        name="my_search",
        source_table="clients",
        search_columns={
            "fn": "first_name",
            "ln": "last_name",
            "full_name": "first_name || ' ' || last_name",
            "age": "{source}.age",
        },
        extra_columns={"non_indexed_column", ("12", "INT")},
    )
    ```

    Will create a view named `my_search` getting its data from the schema `clients` with:

    - An id column which references `source_table_pk`
    - 4 columns indexed for optimized text searching: fn, ln, full_name and age.
      Their value before optimization correspond the evaluated SQL expression in
      the `column` dict.  That SQL expression's type must be TEXT.  When the column
      name and its expression can be ambiguous (eg. age), the str.format pattern `{source}`
      is supported and will be filled accordingly as to avoid ambiguities.
    - An extra column non_indexed_column of type INT which is not meant for text searching
    """
    extra_columns = extra_columns or {}
    if conflicts := [
        col for col in itertools.chain(search_columns, extra_columns) if SEARCH_RESERVED_COLUMNS_REGEXP.match(col)
    ]:
        raise ValueError(f"reserved column name conflicts: '{conflicts}'")
    if not SEARCH_TABLE_REGEXP.match(name):
        raise ValueError(f"invalid table name '{name}', must match {SEARCH_TABLE_REGEXP.pattern}")
    if conflicts := [
        col for col in itertools.chain(search_columns, extra_columns) if not SEARCH_COLUMN_REGEXP.match(name)
    ]:
        raise ValueError(f"invalid column names '{conflicts}', must match {SEARCH_COLUMN_REGEXP.pattern}")
    # Defaults to the view's name camel case-d
    phony_model_name = phony_model_name or name.replace("_", " ").replace("-", " ").title().replace(" ", "")
    create_indexes = ";\n".join(index.create(col, name) for col in search_columns)
    column_exprs = {col: f"osrd_prepare_for_search(({sql}))" for col, sql in search_columns.items()} | {
        col: sql for col, (sql, _) in extra_columns.items()
    }
    select_columns = ", ".join(
        itertools.chain(
            [f'"{source_table}"."{source_table_pk}" AS id'],
            (f'({sql}) AS "{col}"' for col, sql in column_exprs.items()),
        )
    )
    select = f"""SELECT {select_columns} FROM "{source_table}" {query_continuation}"""
    if table_type is SearchTableType.TABLE:
        # NOTE: here source_table has to be a physical table and not a subquery
        search_columns = ", ".join(
            f'"{col}" {type_}'
            for col, type_ in itertools.chain(
                ((col, "TEXT") for col in search_columns), ((col, type_) for col, (_, type_) in extra_columns.items())
            )
        )
        sep = "," if create_table_continuation else ""
        create_table = f"""CREATE TABLE "{name}" (
            id BIGINT REFERENCES "{source_table}"("{source_table_pk}") ON UPDATE CASCADE ON DELETE CASCADE,
            {search_columns}{sep}
            {create_table_continuation}
        )""".format(
            source=source_table
        )
        insert_table = f"""INSERT INTO "{name}" {select}""".format(source=source_table)
        create_triggers, drop_triggers = "", ""
        if triggers:
            c_ins, d_ins = insert_trigger(name, source_table, column_exprs, query_continuation)
            c_upd, d_upd = update_trigger(name, source_table, column_exprs, query_continuation)
            create_triggers = f"{c_ins}\n{c_upd}"
            drop_triggers = f"{d_ins}\n{d_upd}"
        sql = f"{create_table};\n{create_indexes};\n{create_triggers};\n{insert_table}"
        reverse_sql = f'DROP TABLE "{name}";\n{drop_triggers}'
    else:
        table = "MATERIALIZED VIEW" if table_type is SearchTableType.MATERIALIZED_VIEW else "VIEW"
        table_sql = f"""CREATE {table} "{name}" AS ({select})""".format(source=source_table)
        sql = f"{table_sql};\n{create_indexes}"
        reverse_sql = f'DROP {table} "{name}";'
    return migrations.RunSQL(
        sql=sql,
        reverse_sql=reverse_sql,
        # NOTE: Creation of a phony model as an indication for Django that the view exists.
        # That way Django knows when the migration has been applied and can reverse it.
        # Otherwise, DROP VIEW would never be run.
        state_operations=[
            migrations.CreateModel(name=phony_model_name, fields=[], options={"managed": False, "db_table": name})
        ],
    )
