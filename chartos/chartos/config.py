from typing import List, Optional, Dict, NewType
from dataclasses import dataclass, asdict
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
class View:
    name: str
    on_field: str
    fields: List[SelectExpr]
    joins: List[JoinExpr]
    cache_duration: int

    @staticmethod
    def parse(data):
        return View(
            data["name"],
            data["on_field"],
            data["fields"],
            data["joins"],
            data["cache_duration"]
        )

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
            data.get("attribution")
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
