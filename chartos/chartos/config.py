from dataclasses import asdict, dataclass, field
from typing import Dict, List, NewType, Optional

from chartos.utils import ValueDependable

get_config = ValueDependable("get_config")


# select json_col::text as myname from test_table;
#        \______________________/
#           a select expression
SelectExpr = NewType("SelectExpr", str)


# select C.stuff from A inner join B C on C.id = C.id;
#                       \___________________________/
#                             a join expression
#                            C is an alias for B
JoinExpr = NewType("JoinExpr", str)


@dataclass
class Field:
    """
    Represents a part of query that select a field.
    For example:
    ```python
    field = Field("table.data->'name'", "name", "text")
    field.get_query_part() # returns "(table.data->'name')::text as name"
    ```
    """

    field_expr: SelectExpr
    field_name: str
    field_type: str

    @staticmethod
    def parse(data):
        return Field(data["field_expr"], data["field_name"], data["field_type"])

    def get_query_part(self, allow_json_type=True):
        """
        Return the query part that casts the field to the correct type.
        If allow_json_type is False, then json fields will be cast to text.
        """

        if self.field_type.lower() in ["json", "jsonb"]:
            if allow_json_type:
                return f"({self.field_expr}) as {self.field_name}"
            return f"({self.field_expr})::text as {self.field_name}"

        return f"({self.field_expr})::{self.field_type} as {self.field_name}"


@dataclass(eq=True, frozen=True)
class View:
    name: str
    on_field: str = field(compare=False)
    fields: List[Field] = field(compare=False)
    joins: List[JoinExpr] = field(compare=False)
    cache_duration: int = field(compare=False)

    @staticmethod
    def parse(data):
        return View(
            data["name"],
            data["on_field"],
            [Field.parse(field) for field in data["fields"]],
            data.get("joins", []),
            data["cache_duration"],
        )

    def get_fields(self, allow_json_type=True):
        for f in self.fields:
            yield f.get_query_part(allow_json_type)

    def todict(self):
        return asdict(self)


@dataclass
class Layer:
    name: str
    table_name: str
    views: Dict[str, View]
    id_field: Optional[str] = None
    attribution: Optional[str] = None

    @staticmethod
    def parse(data):
        views: Dict[str, View] = {}
        for view_data in data["views"]:
            view = View.parse(view_data)
            views[view.name] = view
        return Layer(
            data["name"],
            data["table_name"],
            views,
            data.get("id_field"),
            data.get("attribution"),
        )

    def todict(self):
        return {
            "name": self.name,
            "table_name": self.table_name,
            "views": [view.todict() for view in self.views.values()],
            "id_field": self.id_field,
            "attribution": self.attribution,
        }


@dataclass
class Config:
    layers: Dict[str, Layer]

    @staticmethod
    def parse(data):
        layers: Dict[str, Layer] = {}
        for layer_data in data:
            layer = Layer.parse(layer_data)
            layers[layer.name] = layer
        return Config(layers)

    def todict(self):
        return [layer.todict() for layer in self.layers.values()]
