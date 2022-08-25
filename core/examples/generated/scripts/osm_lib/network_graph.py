from math import atan2, pi
import time
from pathlib import Path
from typing import List, Tuple, Union, Mapping
from dataclasses import dataclass, field

from .osm_objects import Node, Relation
from .utils.utils import (
    LOGGER,
    PATH_TO_OSM_OBJECTS,
    debug_decorator,
    load_object,
    save_object,
    OUTPUT_DIR,
)

try:
    from railjson_generator import InfraBuilder  # type: ignore
    from railjson_generator.schema.infra.track_section import TrackSection  # type: ignore
    from railjson_generator.schema.infra.direction import Direction  # type: ignore
except ImportError:
    LOGGER.warning("Failed to import railjson libraries. Try to adapt the path or to put this file in another folder")


def angular_distance(angle_1: float, angle_2: float) -> float:
    """Returns the angle bewteen angles 1 and 2. Parameter angles have to be between 0 and 2*pi"""
    angular_dist = abs(angle_1 - angle_2)
    return min(angular_dist, 2 * pi - angular_dist)


def place_signals_detectors(track_section: "TrackSection") -> None:  # noqa
    track_length = track_section.length
    detector = track_section.add_detector(position=track_length / 2)
    offset = min(20, track_length / 4)
    track_section.add_signal(
        linked_detector=detector,
        direction=Direction.START_TO_STOP,
        position=track_length / 2 - offset,
        installation_type="S",
    )
    track_section.add_signal(
        linked_detector=detector,
        direction=Direction.STOP_TO_START,
        position=track_length / 2 + offset,
        installation_type="S",
    )


@dataclass(slots=True)
class Edge:

    start_node: Node = field()
    end_node: Node = field()
    length: float = field(default=-1, compare=False)
    tags: Mapping[str, Union[str, int, float]] = field(default_factory=dict, compare=False, repr=False)
    intermediate_coords: List[Tuple[float, float]] = field(default_factory=list, compare=False, repr=False)
    maxspeed: int = field(default=-1, init=False, compare=False)
    electrified: bool = field(default=False, init=False, compare=False)
    voltage: int = field(default=-1, init=False, compare=False)

    def __post_init__(self) -> None:
        assert self.start_node != self.end_node, "Start node can't be the same than end node in an edge !"
        if self.start_node > self.end_node:
            self.start_node, self.end_node = self.end_node, self.start_node
            self.intermediate_coords = self.intermediate_coords[::-1]
        if self.length == -1:
            self.length = self.start_node.dist(self.end_node)
        self.maxspeed = self.tags.get("maxspeed", -1)
        self.electrified: bool = self.tags.get("electrified") in ["contact_line", "rail", "yes"]
        self.voltage: int = self.tags.get("voltage", -1)

    def angle_with_x_axis(self, reverse: bool = False) -> float:
        """Angle formed between the edge seen as a vector and the horizontal axis.
        The angle returned is between 0 and 2*math.pi
        If the parameter reverse is set to True
        the angle is calculated from the end_node of the edge instead of the start_node"""
        start_coords = self.start_node.coords()
        end_coords = self.intermediate_coords[0] if self.intermediate_coords != [] else self.end_node.coords()
        if reverse:
            start_coords = self.end_node.coords()
            end_coords = self.intermediate_coords[-1] if self.intermediate_coords != [] else self.start_node.coords()
        return atan2(end_coords[1] - start_coords[1], end_coords[0] - start_coords[0]) % (2 * pi)

    def extremities(self):
        return (self.start_node, self.end_node)

    @staticmethod
    def merge(edge_1: "Edge", edge_2: "Edge") -> "Edge":
        length = edge_1.length + edge_2.length
        if edge_1.start_node == edge_2.start_node:
            return Edge(
                start_node=edge_1.end_node,
                end_node=edge_2.end_node,
                length=length,
                intermediate_coords=edge_1.intermediate_coords[::-1]
                + [edge_1.start_node.coords()]
                + edge_2.intermediate_coords,
            )
        if edge_1.start_node == edge_2.end_node:
            return Edge(
                start_node=edge_2.start_node,
                end_node=edge_1.end_node,
                length=length,
                intermediate_coords=edge_2.intermediate_coords
                + [edge_1.start_node.coords()]
                + edge_1.intermediate_coords,
            )
        if edge_1.end_node == edge_2.start_node:
            return Edge(
                start_node=edge_1.start_node,
                end_node=edge_2.end_node,
                length=length,
                intermediate_coords=edge_1.intermediate_coords
                + [edge_1.end_node.coords()]
                + edge_2.intermediate_coords,
            )
        if edge_1.end_node == edge_2.end_node:
            return Edge(
                start_node=edge_1.start_node,
                end_node=edge_2.start_node,
                length=length,
                intermediate_coords=edge_1.intermediate_coords
                + [edge_1.end_node.coords()]
                + edge_2.intermediate_coords[::-1],
            )
        raise ValueError("The two edges are not connected by a node")

    def other_extremity(self, node: Node) -> Node:
        if self.start_node == node:
            return self.end_node
        if self.end_node == node:
            return self.start_node
        raise ValueError("This node is not an extremity of this edge")

    def __hash__(self) -> int:
        return str.__hash__(f"edge{self.start_node}{self.end_node}")


@dataclass(eq=False, slots=True)
class NetworkGraph:
    """Represents a directional graph of a railway network"""

    _from_relation: bool = field(default=False, init=False)
    _relation_id: int = field(default=-1, init=False)

    edges: Mapping[Node, List[Edge]] = field(default_factory=dict, init=False)

    @property
    def nodes(self) -> List[Node]:
        return list(self.edges.keys())

    @property
    def nb_vertices(self) -> int:
        return len(self.edges)

    @property
    def nb_edges(self) -> int:
        return sum(len(edges) for edges in self.edges.values())

    @debug_decorator()
    @staticmethod
    def from_relation(relation: Relation) -> "NetworkGraph":
        """Builds and returns a NetworkGraph from the nodes and edges contained in a relation
        (acts recursively to add all those of children relations too)"""
        start_time = time.time()
        G = NetworkGraph()
        G.add_from_relation(relation)
        G._from_relation = True
        G._relation_id = relation.id
        delta = time.time() - start_time
        h, mn, sec = int(delta // 3600), int((delta % 3600) // 60), int(delta % 60)
        LOGGER.debug(f"\nTime taken to initialise the graph : {h}:{mn}:{sec}\n")
        G.compress()
        return G

    def add_from_relation(self, relation: Relation) -> None:
        """Takes an existing graph and adds the nodes and edges of the parameter relation to it
        (acts recursively to add all those of children relations too)"""
        self.add_nodes(relation.nodes)
        for way in relation.ways:
            self.add_nodes(way.nodes)
            for i in range(len(way.nodes) - 1):
                self.add_edge_from_nodes(way.nodes[i], way.nodes[i + 1], tags=way.tags)
        for relation in relation.relations:
            self.add_from_relation(relation)

    @staticmethod
    def from_relation_id(id: int) -> "NetworkGraph":
        obj_path = Path(f"{PATH_TO_OSM_OBJECTS}/NetworkGraph/{id}")
        if obj_path.exists():
            return load_object(obj_path)
        else:
            G = NetworkGraph.from_relation(Relation.get_by_ID(id))
            save_object(G, obj_path)
            return G

    def from_multiple_relations_ids(*ids: int) -> "NetworkGraph":
        id_str = "_".join([str(id) for id in ids])
        obj_path = Path(f"{PATH_TO_OSM_OBJECTS}/NetworkGraph/{id_str}")
        if obj_path.exists():
            return load_object(obj_path)
        else:
            G = NetworkGraph._from_multiple_relations_ids(*ids)
            save_object(G, obj_path)
            return G

    def _from_multiple_relations_ids(*ids: int) -> "NetworkGraph":
        relations = [Relation.get_by_ID(id) for id in ids]
        start_time = time.time()
        G = NetworkGraph()
        for relation in relations:
            G.add_from_relation(relation)
        LOGGER.info(f"Initial number of nodes : {G.nb_vertices}")
        delta = time.time() - start_time
        h, mn, sec = int(delta // 3600), int((delta % 3600) // 60), int(delta % 60)
        LOGGER.debug(f"\nTime taken to initialise the graph : {h}:{mn}:{sec}\n")
        G.compress()
        return G

    def save(self) -> None:
        assert self._from_relation, "This is not a Network that comes from an OSM Relation"
        save_object(self, Path(f"{PATH_TO_OSM_OBJECTS}/NetworkGraph/{self._relation_id}"))

    @debug_decorator()
    def is_node(self, node: Node) -> bool:
        return node in self.edges.keys()

    def is_edge(self, start_node: Node, end_node: Node) -> bool:
        e = Edge(start_node=start_node, end_node=end_node)
        return e in self.edges[start_node]

    def get_edge(self, start_node: Node, end_node: Node) -> Edge:
        for edge in self.edges[start_node]:
            if edge == Edge(start_node=start_node, end_node=end_node):
                return edge
        raise Exception("There is no such edge in the graph")

    @debug_decorator()
    def add_node(self, node: Node) -> None:
        if not self.is_node(node):
            self.edges[node] = []

    def add_nodes(self, nodes: List[Node]) -> None:
        for node in nodes:
            self.add_node(node)

    def add_edge(self, edge: Edge) -> None:
        if not self.is_edge(edge.start_node, edge.end_node):
            self.edges[edge.start_node].append(edge)
            self.edges[edge.end_node].append(edge)

    def add_edges(self, edges: List[Edge]) -> None:
        for edge in edges:
            self.add_edge(edge)

    def add_edge_from_nodes(
        self, start_node: Node, end_node: Node, tags: Mapping[str, Union[str, int, float]] = {}
    ) -> Edge:
        edge = Edge(start_node=start_node, end_node=end_node, tags=tags)
        self.add_edge(edge)
        return edge

    def add_edges_from_nodes(
        self, start_nodes: List[Node], end_nodes: List[Node], tags: List[Mapping[str, Union[str, int, float]]] = []
    ) -> List[Edge]:
        if tags == []:
            tags = [{} for _ in range(len(start_nodes))]
        edges = []
        for start, end, tag in zip(start_nodes, end_nodes, tags, strict=True):
            edges.append(self.add_edge_from_nodes(start_node=start, end_node=end, tags=tag))
        return edges

    @debug_decorator()
    def remove_node(self, node: Node, strict: bool = False) -> None:
        """If it exists, removes the node and all ingoing and outgoing edges.
        If strict is set to True, raises an error if the node doesn't exist"""
        if strict and not self.is_node(node):
            raise ValueError("This node does not exist in the graph")
        for edge in self.edges[node]:
            self.edges[edge.other_extremity(node)].remove(edge)
        del self.edges[node]

    @debug_decorator()
    def remove_edge(self, start_node: Node, end_node: Node, strict=False) -> None:
        """If it exists, removes the edge between the two parameter nodes.
        If strict is set to True, raises an error if the edge doesn't exist"""
        if not self.is_edge(start_node=start_node, end_node=end_node):
            if strict:
                raise ValueError("This edge does not exist in this graph")
            return
        e = Edge(start_node=start_node, end_node=end_node)
        self.edges[start_node].remove(e)
        self.edges[end_node].remove(e)

    def neighbours(self, node: Node) -> List[Node]:
        return [edge.other_extremity(node) for edge in self.edges[node]]

    def compress(self) -> None:
        debug_initial_nb_vertices = self.nb_vertices
        for node in self.nodes[:]:
            neighbours = self.neighbours(node)
            if len(neighbours) == 2 and node.tags == {}:
                new_edge = Edge.merge(*self.edges[node])
                self.add_edge(new_edge)
                self.remove_node(node)
        LOGGER.info(f"Managed to reduce the number of nodes from {debug_initial_nb_vertices} to {self.nb_vertices}")

    def _build_railjson_links_and_switches(self, builder: "InfraBuilder", tracks: Mapping[Edge, "TrackSection"]):
        error_counter = 0
        for node in self.nodes:
            edges = self.edges[node]
            nb_edges = len(edges)
            if nb_edges <= 1:
                continue
            if nb_edges == 2:
                track_0, track_1 = [tracks[edge] for edge in edges]
                endpoint_0 = track_0.begin() if node == edges[0].start_node else track_0.end()
                endpoint_1 = track_1.begin() if node == edges[1].start_node else track_1.end()
                builder.add_link(endpoint_0, endpoint_1)

            elif nb_edges == 3:
                angle_0, angle_1, angle_2 = [
                    edge.angle_with_x_axis() if node == edge.start_node else edge.angle_with_x_axis(reverse=True)
                    for edge in edges
                ]
                track_0, track_1, track_2 = [tracks[edge] for edge in edges]
                min_angle = min(
                    angular_distance(angle_0, angle_1),
                    angular_distance(angle_0, angle_2),
                    angular_distance(angle_1, angle_2),
                )
                endpoint_0 = track_0.begin() if node == edges[0].start_node else track_0.end()
                endpoint_1 = track_1.begin() if node == edges[1].start_node else track_1.end()
                endpoint_2 = track_2.begin() if node == edges[2].start_node else track_2.end()
                if min_angle == angular_distance(angle_0, angle_1):
                    builder.add_point_switch(endpoint_2, endpoint_0, endpoint_1)
                elif min_angle == angular_distance(angle_0, angle_2):
                    builder.add_point_switch(endpoint_1, endpoint_0, endpoint_2)
                elif min_angle == angular_distance(angle_1, angle_2):
                    builder.add_point_switch(endpoint_0, endpoint_1, endpoint_2)

            elif nb_edges == 4:
                angle_0, angle_1, angle_2, angle_3 = [
                    edge.angle_with_x_axis() if node == edge.start_node else edge.angle_with_x_axis(reverse=True)
                    for edge in edges
                ]
                track_0, track_1, track_2, track_3 = [tracks[edge] for edge in edges]
                endpoint_0 = track_0.begin() if node == edges[0].start_node else track_0.end()
                endpoint_1 = track_1.begin() if node == edges[1].start_node else track_1.end()
                endpoint_2 = track_2.begin() if node == edges[2].start_node else track_2.end()
                endpoint_3 = track_3.begin() if node == edges[3].start_node else track_3.end()
                threshold = pi / 6
                if angular_distance(angle_0, angle_1) < threshold:
                    builder.add_double_cross_switch(endpoint_0, endpoint_1, endpoint_2, endpoint_3)
                elif angular_distance(angle_0, angle_2) < threshold:
                    builder.add_double_cross_switch(endpoint_0, endpoint_2, endpoint_1, endpoint_3)
                elif angular_distance(angle_0, angle_3) < threshold:
                    builder.add_double_cross_switch(endpoint_0, endpoint_3, endpoint_1, endpoint_2)
                elif angular_distance(angle_1, angle_2) < threshold:
                    builder.add_double_cross_switch(endpoint_0, endpoint_3, endpoint_1, endpoint_2)
                elif angular_distance(angle_1, angle_3) < threshold:
                    builder.add_double_cross_switch(endpoint_0, endpoint_2, endpoint_1, endpoint_3)
                elif angular_distance(angle_2, angle_3) < threshold:
                    builder.add_double_cross_switch(endpoint_0, endpoint_1, endpoint_2, endpoint_3)
                else:
                    builder.add_cross_switch(endpoint_0, endpoint_1, endpoint_2, endpoint_3)

            else:
                error_counter += 1
        LOGGER.warning(f"\nFailed to link {error_counter} nodes because there were more than 4 edges linked to it\n")

    def to_railjson(self) -> None:
        if not Path.is_dir(OUTPUT_DIR):
            Path.mkdir(OUTPUT_DIR)

        builder = InfraBuilder()

        tracks: Mapping[Edge, "TrackSection"] = {}
        for node in self.nodes:
            for edge in self.edges[node]:
                # Condition needed in order to not add tracks twice
                # beacuse edges are stored twice, on the neighbour list of each extremity
                if edge.start_node == node:
                    track = builder.add_track_section(edge.length)
                    track.set_remaining_coords(
                        [[edge.start_node.lon, edge.start_node.lat]]
                        + [list(coord) for coord in edge.intermediate_coords]
                        + [[edge.end_node.lon, edge.end_node.lat]]
                    )
                    place_signals_detectors(track)
                    tracks[edge] = track
        self._build_railjson_links_and_switches(builder, tracks)
        # self._build_railjson_switches()
        # self._build_railjson_speed_sections()
        # TODO

        # Build infra: Generate BufferStops, TVDSections and Routes, and save railjson
        infra = builder.build()
        infra.save(OUTPUT_DIR / Path("infra.json"))

    def __repr__(self) -> str:
        vertices_string = ""
        edges_string = ""
        for node in self.nodes:
            vertices_string += f"{node}\n"
        for edge in self.ingoing_edges.values():
            edges_string += f"{edge}\n"
        return f"NetworkGraph, nodes = \n{vertices_string}, edges = \n{edges_string}"
