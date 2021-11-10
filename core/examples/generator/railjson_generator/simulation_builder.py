from collections import defaultdict
from dataclasses import dataclass, field
from typing import List, Mapping

from railjson_generator.schema.infra.infra import Infra
from railjson_generator.schema.infra.route import Route
from railjson_generator.schema.infra.switch import Switch
from railjson_generator.schema.location import Location
from railjson_generator.schema.simulation.simulation import Simulation
from railjson_generator.schema.simulation.train_schedule import TrainSchedule
from railjson_generator.schema.simulation.train_succession_table import TST
from railjson_generator.utils.pathfinding import RoutePathfindingStep, find_route_path


@dataclass
class RouteNode:
    route: Route
    neighbors: List["RouteNode"] = field(default_factory=list)

    def length(self):
        length = 0
        for path_elem in self.route.path_elements:
            length += path_elem.length()
        return length

    def __hash__(self):
        return hash(self.route)

    def _eq__(self, other):
        return self.route == other.route


@dataclass
class RangeRoute:
    route_node: RouteNode
    track_begin: float
    track_end: float
    offset: float

    def contains(self, offset) -> bool:
        if offset < self.track_begin and offset < self.track_end:
            return False
        if offset > self.track_begin and offset > self.track_end:
            return False
        return True


class SimulationBuilder:
    def __init__(self, infra: Infra):
        self.infra: Infra = infra
        self.simulation: Simulation = Simulation()
        self.route_to_nodes: Mapping[str, RouteNode] = {}
        self.track_to_routes: Mapping[str, List[RangeRoute]] = defaultdict(list)

        self.init_route_graph()

    def init_route_graph(self):
        waypoints_to_routes = defaultdict(list)
        for route in self.infra.routes:
            node = RouteNode(route)
            self.route_to_nodes[route.label] = node
            waypoints_to_routes[route.entry_point.label].append(node)

        for node in self.route_to_nodes.values():
            node.neighbors = waypoints_to_routes[node.route.exit_point.label]

        for route in self.infra.routes:
            offset = 0
            for path_element in route.path_elements:
                track_name = path_element.track_section.label
                node = self.route_to_nodes[route.label]
                self.track_to_routes[track_name].append(
                    RangeRoute(node, path_element.begin, path_element.end, offset)
                )
                offset += path_element.length()

    def _find_route_path(self, locations: List[Location]):
        result = []
        origins = []
        for range_route in self.track_to_routes[locations[0].track_section.label]:
            if not range_route.contains(locations[0].offset):
                continue
            origins.append(
                RoutePathfindingStep(
                    range_route.route_node,
                    offset=range_route.offset
                    + abs(range_route.track_begin - locations[0].offset),
                )
            )
        for loc_end in locations[1:]:
            goals = set()
            for range_route in self.track_to_routes[loc_end.track_section.label]:
                if not range_route.contains(loc_end.offset):
                    continue
                goals.add(range_route.route_node)
            path = find_route_path(origins, goals)
            if not path:
                raise RuntimeError("Train schedule creation: couldn't find a path")
            result += path
            origins = [RoutePathfindingStep(path[-1])]
        routes = []
        for route_node in result:
            if routes and route_node.route == routes[-1]:
                continue
            routes.append(route_node.route)
        return routes

    def add_train_schedule(self, *locations: List[Location], **kwargs) -> TrainSchedule:
        if len(locations) < 2:
            raise ValueError(f"Expected at least 2 locations, got {len(locations)}")
        routes = self._find_route_path(locations)
        train_schedule = TrainSchedule(locations[0], locations[-1], routes, **kwargs)
        self.simulation.train_schedules.append(train_schedule)
        return train_schedule

    def add_tst(self, switch: Switch, *train_order):
        tst = TST(switch, train_order)
        self.simulation.train_succession_tables.append(tst)
        return tst

    def build(self) -> Simulation:
        return self.simulation
