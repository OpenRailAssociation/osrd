from abc import ABC
from typing import Union, TypeVar, List, Mapping, Tuple
import math
from pathlib import Path
from dataclasses import InitVar, dataclass, field

from .utils.utils import (
    LOGGER,
    PATH_TO_OSM_OBJECTS,
    debug_decorator,
    load_object,
    save_object,
    clear_duplicates,
    RelationTypes,
)
from .utils.request_utils import query_overpass_api


T = TypeVar("T")
OVERPASS_TIMEOUT = 180  # Max request time in seconds


@dataclass(eq=False, slots=True)
class Element(ABC):

    id: int = field()
    tags: Mapping[str, Union[str, int, float]] = field(default_factory=dict, compare=False)

    @classmethod
    def _query_by_ID(cls: T, id: int) -> T:
        """Queries the overpass api, and returns an object of the corresponding class"""
        class_name = cls.__name__
        class_name_for_query = class_name.lower().replace("relation", "rel")
        assert class_name != "Element", "Please call this method with one of the subclasses"
        query = f"""[out:json][timeout:{OVERPASS_TIMEOUT}];{class_name_for_query}({id});out;"""
        element = query_overpass_api(query)["elements"][0]
        if class_name == "Node":
            return Node(id=element["id"], lon=element["lon"], lat=element["lat"], tags=element.get("tags", {}))
        elif class_name == "Way":
            return Way(id=element["id"], tags=element.get("tags", {}), call_initialise_nodes=True)
        elif class_name == "Relation":
            return Relation(id=element["id"], tags=element.get("tags", {}), initialise_members=True)

    @classmethod
    def get_by_ID(cls: T, id: int) -> T:
        """Returns the object of specified ID.
        Tries to find it as a saved file first, and if it's not saved, saves the object before returning it"""
        assert id > 0, "id has to be a positive integer in order to query OpenStreetMap API"
        class_name = cls.__name__
        obj_path = Path(f"{PATH_TO_OSM_OBJECTS}/{class_name}/{id}")
        if obj_path.exists():
            obj = load_object(obj_path)
        else:
            for dir_name in ["Node", "Way", "Relation"]:
                object_path = Path(f"{PATH_TO_OSM_OBJECTS}/{dir_name}")
                if not object_path.exists():
                    object_path.mkdir(exist_ok=True, parents=True)
            obj = cls._query_by_ID(id)
            obj.save()
        return obj

    def save(self) -> None:
        """Saves the object to a file to save changes. This overwrites the previous save"""
        class_name = self.__class__.__name__
        save_object(self, Path(f"{PATH_TO_OSM_OBJECTS}/{class_name}/{self.id}"))

    def delete_save(self) -> None:
        """Deletes the file associated with the object"""
        class_name = self.__class__.__name__
        obj_path = Path(f"{PATH_TO_OSM_OBJECTS}/{class_name}/{self.id}")
        if obj_path.exists():
            obj_path.unlink()
            LOGGER.info(f"Deleted {self.__class__.__name__} of id {self.id}")
        else:
            LOGGER.warning(
                f"Couldn't delete the {self.__class__.__name__} of id {self.id} because the file wasn't found"
            )

    def repair(self) -> None:
        """Deletes the saved file associated with the instance, then reinitialises the instance with an online query"""
        self.delete_save()
        new_instance = self.__class__.get_by_ID(self.id)
        new_instance.save()


@dataclass(repr=False, slots=True)
class Node(Element):

    lon: float = field(default=0.0)
    lat: float = field(default=0.0)

    def dist(self, node: "Node") -> float:
        """Returns the distance between the Nodes self and the other node parameter"""
        EARTH_RADIUS = 6371000
        return math.sqrt((self.lat - node.lat) ** 2 + (self.lon - node.lon) ** 2) * EARTH_RADIUS * math.pi / 180

    def find_closest_node(self, nodes: List["Node"]) -> int:
        """Takes a list of nodes as an argument.
        Returns the index of the closest node to self in the list, except itself.
        Returns -1 if the input list is empty"""
        minDist = math.inf
        minIndex = -1
        for i, elt in enumerate(nodes):
            if 0 < self.dist(elt) <= minDist:
                minDist = self.dist(elt)
                minIndex = i
        return minIndex

    def coords(self) -> Tuple[float, float]:
        """returns a tuple containing the coords of the node"""
        return (self.lon, self.lat)

    @staticmethod
    def to_vect(start_node: "Node", end_node: "Node") -> Tuple[float, float]:
        """Returns a tuple containing the coords of a vector pointing from start_node to end_node"""
        start_coords = start_node.coords()
        end_coords = end_node.coords()
        return (end_coords[0] - start_coords[0], end_coords[1] - start_coords[1])

    @debug_decorator()
    @staticmethod
    def sort_nodes(nodes: List["Node"]) -> None:
        """Sorts the nodes in the argument list in order to form a logical georaphical path.
        Only works for a list of nodes arranged in a linear pattern.
        Changes the list in place"""
        i = 0
        while i < len(nodes) - 1:
            nextNodeIndex = (i + 1) + nodes[i].find_closest_node(nodes[i + 1 :])  # noqa
            while i < len(nodes) - 1 and nodes[i].dist(nodes[nextNodeIndex]) <= nodes[0].dist(nodes[nextNodeIndex]):
                # This node is closer to the end of the path : add it at index i+1
                nodes.insert(i + 1, nodes.pop(nextNodeIndex))
                i += 1
                if i < len(nodes) - 1:
                    nextNodeIndex = (i + 1) + nodes[i].find_closest_node(nodes[i + 1 :])  # noqa
            if i < len(nodes) - 1:
                nextNodeIndex = (i + 1) + nodes[0].find_closest_node(nodes[i + 1 :])  # noqa
            while i < len(nodes) - 1 and nodes[i].dist(nodes[nextNodeIndex]) >= nodes[0].dist(nodes[nextNodeIndex]):
                # This node is closer to the beginning : insert it at the beginning
                nodes.insert(0, nodes.pop(nextNodeIndex))
                i += 1
                if i < len(nodes) - 1:
                    nextNodeIndex = (i + 1) + nodes[0].find_closest_node(nodes[i + 1 :])  # noqa

    @staticmethod
    def get_coords(nodes: List["Node"]) -> List[Tuple[float, float]]:
        """Returns a list of tuples corresponding to the node's coords in the parameter list"""
        coords = []
        for node in nodes:
            coords.append((node.lon, node.lat))
        return coords

    def is_railway_station(self) -> bool:
        return self.tags.get("public_transport") in ["stop_position", "halt"] or self.tags.get("railway") in [
            "stop",
            "stop_position",
            "halt",
        ]

    def __lt__(self, __o: object) -> bool:
        assert isinstance(__o, self.__class__)
        return self.id < __o.id

    def __gt__(self, __o: object) -> bool:
        assert isinstance(__o, self.__class__)
        return self.id > __o.id

    def __le__(self, __o: object) -> bool:
        return self < __o or self == __o

    def __ge__(self, __o: object) -> bool:
        return self > __o or self == __o

    def __hash__(self) -> int:
        return str.__hash__(f"node{self.id}")

    def __repr__(self) -> str:
        description = self.__str__()
        tags_string = ""
        for key, value in self.tags.items():
            tags_string += str(key) + " : " + str(value) + "\n"
        description = description[:-1] + ",\n\ttags=\n" + tags_string + ")"
        return description

    def __str__(self) -> str:
        return f"Node(id={self.id}, lon={self.lon}, lat={self.lat})"


@dataclass(repr=False, slots=True)
class Way(Element):
    """Class that represents a OpenStreetMap way.
    The constructor should never be called directly.
    Use either of the staticmethods 'get_by_ID' of 'from_node_list' instead"""

    nodes_ids: List[int] = field(default_factory=list, init=False)
    _nodes: List[Node] = field(default_factory=list, init=False)
    nodes_are_initialised: bool = field(default=False, init=False)
    call_initialise_nodes: InitVar[bool] = True

    def __post_init__(self, call_initialise_nodes: bool) -> None:
        if call_initialise_nodes:
            self.initialise_nodes()
        self.nodes_ids = [node.id for node in self._nodes]

    @staticmethod
    def from_node_list(nodes: list[Node], id: int = -1, tags: Mapping[str, Union[str, int, float]] = {}) -> "Way":
        assert len(nodes) >= 2, "A way has to have at least two nodes"
        way = Way(id=id, tags=tags, call_initialise_nodes=False)
        way.nodes_ids = [node.id for node in nodes]
        way._nodes = nodes
        way.nodes_are_initialised = True
        return way

    def get_nodes_IDs(self) -> List[int]:
        return self.nodes_ids

    @property
    def nodes(self) -> List[Node]:
        if not self.nodes_are_initialised:
            self.initialise_nodes()
        return self._nodes

    @nodes.setter
    def set_nodes(self, value: List[Node]) -> None:
        self._nodes = value

    @staticmethod
    def are_linked(way1: "Way", way2: "Way", strict: bool = True) -> bool:
        """Indicates weather two lists of nodes have a node in common.
        If strict is true (default), only tries to match the extremities"""
        nodes1 = way1.nodes
        nodes2 = way2.nodes
        if len(nodes1) == 0 or len(nodes2) == 0:
            return False
        if strict:
            return (nodes1[0] in (nodes2[0], nodes2[-1])) or (nodes1[-1] in (nodes2[0], nodes2[-1]))
        for node in nodes1:
            if node in nodes2:
                return True
        return False

    def initialise_nodes(self) -> None:
        """Initialises self._nodes with Node objects"""
        self._nodes = []
        query = f"[out:json];way({self.id});node(w);out;"
        elements = query_overpass_api(query)["elements"]
        assert (
            len(elements) > 0
        ), "You did a query that returned an empty way ! Maybe you did a query with a negative id ? ..."
        for elt in elements:
            assert elt["type"] == "node", "How the hell is there a way that has something else than nodes as an element"
            self._nodes.append(Node(elt["id"], elt["lon"], elt["lat"], elt.get("tags", {})))
        self.nodes_are_initialised = True
        self._nodes.sort(key=lambda node: self.nodes_ids.index(node.id))

    def neigbour(self, node: Node) -> Node:
        """Returns the neigbour node of the parameter node if it is at an extremity. Otherwise, raise an exception"""
        if node == self.nodes[0]:
            return self.nodes[1]
        elif node == self.nodes[-1]:
            return self.nodes[-2]
        raise ValueError("The parameter node isn't at an extremity of the way")

    def __repr__(self) -> str:
        nodes_string = ""
        for elt in self.nodes:
            nodes_string += f"{elt.id}, "
        return f"Way(id={self.id}, \nnodes=\n{nodes_string[:-2]})"

    def __str__(self) -> str:
        return f"Way(id={self.id})"


@dataclass(repr=False, slots=True)
class Relation(Element):
    """Class that represents a OpenStreetMap relation.
    The constructor should never be called directly.
    Use either of the staticmethods 'get_by_ID' of 'from_lists' instead"""

    nodes: List[Node] = field(default_factory=list, init=False)
    ways: List[Way] = field(default_factory=list, init=False)
    relations: List["Relation"] = field(default_factory=list, init=False)
    stations: List[Node] = field(default_factory=list, init=False)
    switches: List[Node] = field(default_factory=list, init=False)
    signals: List[Node] = field(default_factory=list, init=False)
    _itinerary_nodes: List[Node] = field(default_factory=list, init=False)
    type: RelationTypes = field(default=RelationTypes.OTHER, init=False)
    initialise_members: InitVar[bool] = True

    def __post_init__(self, initialise_members: bool) -> None:
        if initialise_members:
            self.initialise()
            self._initialise_members()

    @staticmethod
    def get_by_ID(id: int) -> "Relation":
        object_path = Path(f"{PATH_TO_OSM_OBJECTS}/Relation/{id}")
        if object_path.exists():
            return load_object(object_path)
        else:
            folder_path = Path(f"{PATH_TO_OSM_OBJECTS}/Relation")
            if not folder_path.exists():
                folder_path.mkdir(exist_ok=True, parents=True)

        query = f"[out:json][timeout:{OVERPASS_TIMEOUT}];rel({id});>>;out;"
        query_elements: List[Mapping[str, Union[str, int, float]]] = query_overpass_api(query)["elements"]
        element_nodes: Mapping[int, Node] = {}
        element_ways: Mapping[int, Way] = {}
        element_relations: Mapping[int, Relation] = {}
        # Initialise nodes
        for element in query_elements:
            if element["type"] == "node":
                node = Node(id=element["id"], tags=element.get("tags", {}), lon=element["lon"], lat=element["lat"])
                element_nodes[element["id"]] = node
        # Initialise ways
        for element in query_elements:
            if element["type"] == "way":
                nodes_list = [element_nodes[node_id] for node_id in element["nodes"]]
                way = Way.from_node_list(nodes_list, id=element["id"], tags=element.get("tags", {}))
                element_ways[element["id"]] = way

        # Initialise relations
        query_relations = [element for element in query_elements if element["type"] == "relation"]
        # Mapping to keep track of which relations were initialised :
        relation_is_initialised: Mapping[int, bool] = {int(element["id"]): False for element in query_relations}
        number_of_relations_to_initialise = len(query_relations)

        while number_of_relations_to_initialise > 0:
            for query_relation in query_relations:
                children_relations_ids = [
                    member["ref"] for member in query_relation["members"] if member["type"] == "relation"
                ]
                if all(relation_is_initialised[id] for id in children_relations_ids):
                    relation_is_initialised[query_relation["id"]] = True
                    number_of_relations_to_initialise -= 1
                    query_relations.remove(query_relation)
                    rel = Relation.from_lists(
                        id=query_relation["id"],
                        tags=query_relation["tags"],
                        nodes=[
                            element_nodes[member["ref"]]
                            for member in query_relation["members"]
                            if member["type"] == "node"
                        ],
                        ways=[
                            element_ways[member["ref"]]
                            for member in query_relation["members"]
                            if member["type"] == "way"
                        ],
                        relations=[
                            element_relations[member["ref"]]
                            for member in query_relation["members"]
                            if member["type"] == "relation"
                        ],
                    )
                    element_relations[rel.id] = rel
                    file_path = Path(f"{PATH_TO_OSM_OBJECTS}/Relation/{rel.id}")
                    save_object(rel, file_path)

        return load_object(object_path)

    @staticmethod
    def from_lists(
        id: int,
        tags: Mapping[str, Union[str, int, float]],
        nodes: List[Node],
        ways: List[Way],
        relations: List["Relation"],
    ) -> "Relation":
        rel = Relation(id=id, tags=tags, initialise_members=False)
        rel.nodes = nodes
        rel.ways = ways
        rel.relations = relations
        rel.initialise()
        return rel

    # GETTERS AND SETTERS

    @property
    def itinerary_nodes(self) -> List[Node]:
        self._initialise_itinerary_nodes()
        return self._itinerary_nodes

    @itinerary_nodes.setter
    def set_itinerary_nodes(self, value: List[Node]) -> None:
        self._itinerary_nodes = value

    # OTHER METHODS

    @debug_decorator()
    def initialise(self) -> None:
        self._initialise_type()
        self._filter_nodes()
        self._filter_ways()
        self._filter_relations()
        self._initialise_stations()
        self._initialise_switches()
        self._initialise_signals()

    @debug_decorator()
    def _initialise_members(self) -> None:
        """Initialises the fields nodes, ways and relations of the Relation"""
        LOGGER.info(f"initialising members of new {self.__class__.__name__} : id={self.id}")
        self.nodes = []
        self.ways = []
        self.relations = []
        query = f"""[out:json];rel({self.id})->.rel;(rel(r.rel);way(r.rel);node(r.rel););out;"""
        elements = query_overpass_api(query)["elements"]
        for elt in elements:
            if elt["type"] == "node":
                self.nodes.append(Node(id=elt["id"], lon=elt["lon"], lat=elt["lat"], tags=elt.get("tags", {})))
            elif elt["type"] == "way":
                self.ways.append(Way.get_by_ID(elt["id"]))
            elif elt["type"] == "relation":
                LOGGER.info(f"Adding the relation {elt['id']} to the relation of id {self.id}")
                self.relations.append(Relation.get_by_ID(elt["id"]))

    def _initialise_type(self) -> None:
        if self.tags.get("type", "other") in ["network", "route_master", "route"]:
            self.type = RelationTypes(self.tags.get("type", "other"))

    def _initialise_stations(self) -> None:
        self.stations = []
        for node in self.nodes:
            if node.tags.get("public_transport") in ["stop_position", "halt"] or node.tags.get("railway") in [
                "stop",
                "stop_position",
                "halt",
            ]:
                # removed "station" from the railway list, that in general describes an area an not a point of the track
                self.stations.append(node)

    def _initialise_itinerary_nodes(self) -> None:
        self._itinerary_nodes = []
        # self._itinerary_nodes += self.stations # Deleted stations from itinerary nodes for more consistend path.
        for way in self.ways:
            if way.tags.get("railway") in ["rail", "subway", "light_rail"]:
                self._itinerary_nodes += way.nodes
        clear_duplicates(self._itinerary_nodes)
        Node.sort_nodes(self._itinerary_nodes)

    def _initialise_switches(self) -> None:
        self.switches = []
        for way in self.ways:
            for node in way.nodes:
                if ("railway", "switch") in node.tags.items():
                    self.switches.append(node)
        clear_duplicates(self.switches)

    def _initialise_signals(self) -> None:
        self.signals = []
        for way in self.ways:
            for node in way.nodes:
                if ("railway", "signal") in node.tags.items():
                    self.signals.append(node)
        clear_duplicates(self.signals)

    def _filter_nodes(self) -> None:
        i = 0
        while i < len(self.nodes):
            if (self.nodes[i].tags.get("public_transport") == "station") or (
                self.nodes[i].tags.get("railway") == "station"
            ):
                del self.nodes[i]
            else:
                i += 1

    def _filter_ways(self) -> None:
        """Filters out all member ways that are not raillines, including platforms, inconsistent ways in OSM, etc."""
        i = 0
        while i < len(self.ways):
            if (
                (self.ways[i].tags.get("public_trasport") == "platform")
                or (self.ways[i].tags.get("railway") == "platform")
                or (self.ways[i].tags.get("public_trasport") == "station")
                or (self.ways[i].tags.get("railway") == "platform_edge")
            ):
                del self.ways[i]
            else:
                i += 1

    def _filter_relations(self) -> None:
        i = 0
        while i < len(self.relations):
            if (self.relations[i].tags.get("public_transport") == "platform") or (
                self.relations[i].tags.get("railway") == "platform"
            ):
                del self.relations[i]
            else:
                i += 1

    def get_itinerary_length(self) -> float:
        length = 0.0
        for i in range(len(self.itinerary_nodes) - 1):
            length += self.itinerary_nodes[i].dist(self.itinerary_nodes[i + 1])
        return length

    def get_itinerary_length_between_nodes(self, start_node: Node, end_node: Node) -> float:
        start_index = self.itinerary_nodes.index(start_node)
        end_index = self.itinerary_nodes.index(end_node)
        if start_index > end_index:
            start_index, end_index = end_index, start_index
        length = 0.0
        for i in range(start_index, end_index):
            length += self.itinerary_nodes[i].dist(self.itinerary_nodes[i + 1])
        return length

    def get_stations_coords(self) -> List[Tuple[float, float]]:
        """Helper function for draw; Returns a list of all the coordinates of the stations the itinerary goes through"""
        return Node.get_coords(self.stations)

    def get_stations_labels(self) -> List[str]:
        labels = []
        for node in self.stations:
            labels.append(node.tags.get("name", "Station name not available"))
        return labels

    def get_route_coords(self) -> List[Tuple[float, float]]:
        """Helper function for draw; Returns a list of all the coordinates of the nodes the itinerary goes through"""
        return Node.get_coords(self.itinerary_nodes)

    def get_switches_coords(self) -> List[Tuple[float, float]]:
        return Node.get_coords(self.switches)

    def get_signals_coords(self) -> List[Tuple[float, float]]:
        return Node.get_coords(self.signals)

    def __repr__(self) -> str:
        relations_string = ""
        ways_string = ""
        nodes_string = ""
        for rel in self.relations:
            relations_string += f"\t{rel.id}\n"
        for way in self.ways:
            ways_string += f"\t{way}\n"
        for node in self.nodes:
            nodes_string += f"\t{node}\n"
        return (
            f"Relation(id={self.id}, \nrelations=\n{relations_string}, \nways={ways_string}, \nnodes={nodes_string}\n)"
        )
