import schemas
import heapq
from dataclasses import dataclass, field
from typing import List, Optional, Set

from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.endpoint import Endpoint
from railjson_generator.schema.infra.track_section import TrackSection


@dataclass
class PathfindingStep:
    track_section: TrackSection
    offset: float
    direction: Direction
    previous: Optional["PathfindingStep"] = field(default=None)


@dataclass
class PathElement:
    track_section: TrackSection
    direction: Direction
    begin: float
    end: float

    def length(self):
        return abs(self.begin - self.end)

    def to_rjs(self):
        return schemas.DirectionalTrackRange(
            track=self.track_section.make_rjs_ref(),
            begin=self.begin,
            end=self.end,
            direction=schemas.Direction[self.direction.name]
        )

Path = List[PathElement]


def build_path(path: PathfindingStep) -> Path:
    flat_steps: List[PathfindingStep] = []
    while path is not None:
        flat_steps.append(path)
        path = path.previous
    flat_steps.reverse()

    res: List[PathElement] = []
    for i in range(len(flat_steps) - 2):
        cur_step = flat_steps[i]
        if cur_step.direction == Direction.START_TO_STOP:
            end_offset = cur_step.track_section.length
        else:
            end_offset = 0

        res.append(
            PathElement(
                cur_step.track_section,
                cur_step.direction,
                cur_step.offset,
                end_offset,
            )
        )

    last = flat_steps[-1]
    before_last = flat_steps[-2]
    assert last.track_section is before_last.track_section
    res.append(
        PathElement(
            last.track_section,
            last.direction,
            before_last.offset,
            last.offset,
        )
    )
    return res


def search_signal(candidate) -> bool:
    signals = candidate.track_section.signals
    if candidate.direction == Direction.STOP_TO_START:
        signals = list(reversed(signals))
    for signal in signals:
        if candidate.direction != signal.direction:
            continue
        if (
            candidate.direction == Direction.START_TO_STOP
            and signal.position <= candidate.offset
        ):
            continue
        if (
            candidate.direction == Direction.STOP_TO_START
            and signal.position >= candidate.offset
        ):
            continue
        return signal
    return None


def search_buffer_stop(candidate) -> bool:
    waypoints = candidate.track_section.waypoints
    if candidate.direction == Direction.STOP_TO_START:
        waypoints = list(reversed(waypoints))
    for waypoint in waypoints:
        if (
            candidate.direction == Direction.START_TO_STOP
            and waypoint.position <= candidate.offset
        ):
            continue
        if (
            candidate.direction == Direction.STOP_TO_START
            and waypoint.position >= candidate.offset
        ):
            continue
        if waypoint.waypoint_type == "buffer_stop":
            return waypoint
    return None


def explore_paths(origin):
    stack = [origin]
    paths = []
    visited = set()
    while stack:
        candidate = stack.pop()
        visited.add(candidate.track_section.label)
        signal = search_signal(candidate)
        if signal is not None:
            paths.append(
                PathfindingStep(
                    candidate.track_section,
                    signal.linked_detector.position,
                    candidate.direction,
                    previous=candidate,
                )
            )
            continue
        bf = search_buffer_stop(candidate)
        if bf is not None:
            paths.append(
                PathfindingStep(
                    candidate.track_section,
                    bf.position,
                    candidate.direction,
                    previous=candidate,
                )
            )
            continue

        for neighbor in candidate.track_section.neighbors(candidate.direction):
            if neighbor.track_section.label in visited:
                continue
            if neighbor.endpoint == Endpoint.BEGIN:
                direction = Direction.START_TO_STOP
                offset = 0
            else:
                direction = Direction.STOP_TO_START
                offset = neighbor.track_section.length

            stack.append(
                PathfindingStep(
                    neighbor.track_section,
                    offset,
                    direction,
                    previous=candidate,
                )
            )

    return [build_path(path) for path in paths]


@dataclass(order=True)
class RoutePathfindingStep:
    route_node: "RouteNode" = field(compare=False)
    previous: Optional["RoutePathStep"] = field(default=None, compare=False)
    offset: float = field(default=0, compare=False)
    cost: float = field(default=0)


def build_route_path(step: RoutePathfindingStep) -> List["RouteNode"]:
    result = []
    while step:
        result.append(step.route_node)
        step = step.previous
    return list(reversed(result))


def find_route_path(
    origins: List[RoutePathfindingStep],
    goals: Set["RouteNode"],
) -> List["RouteNode"]:
    heapq.heapify(origins)
    queue = origins
    visited: Set["RouteNode"] = set()
    while queue:
        candidate: RoutePathfindingStep = heapq.heappop(queue)
        visited.add(candidate.route_node)

        if candidate.route_node in goals:
            return build_route_path(candidate)

        for neighbor in candidate.route_node.neighbors:
            if neighbor in visited:
                continue
            added_cost = candidate.route_node.length() - candidate.offset
            heapq.heappush(
                queue,
                RoutePathfindingStep(
                    neighbor, candidate, cost=candidate.cost + added_cost
                ),
            )
    return []
