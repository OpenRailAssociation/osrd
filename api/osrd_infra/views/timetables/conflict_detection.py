import json
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

from rest_framework.generics import get_object_or_404

from osrd_infra.models import PathModel
from osrd_infra.schemas.path import PathPayload


@dataclass(frozen=True)
class TrainData:
    pk: int
    name: str
    departure_time: float


@dataclass(frozen=True)
class Simulation:
    route_occupation: Dict
    train_data: TrainData


@dataclass(frozen=True)
class RouteOffsets:
    start: float
    end: float


@dataclass(frozen=True)
class RouteUse:
    train_data: TrainData
    time_start: float
    time_end: float


@dataclass(frozen=True)
class Conflict:
    first_train: TrainData
    second_train: TrainData
    time_start: float
    time_end: float
    position_start: Optional[float] = field(hash=False, compare=False)
    position_end: Optional[float] = field(hash=False, compare=False)

    def to_dict(self):
        res = {
            "first_train": self.first_train.pk,
            "second_train": self.second_train.pk,
            "time_start": self.time_start,
            "time_end": self.time_end,
        }
        if self.position_start is not None:
            res["position_start"] = self.position_start
        if self.position_end is not None:
            res["position_end"] = self.position_end
        return res


def list_conflicts(timetable, request):
    params = json.loads(request.body)
    simulations = _get_simulations(timetable)
    if "path" in params:
        path_id = params["path"]
        path = get_object_or_404(PathModel, pk=path_id)
        projection_path_payload = PathPayload.parse_obj(path.payload)
        route_offsets = _make_route_offsets(projection_path_payload)
    else:
        route_offsets = {}
    conflicts = [conflict.to_dict() for conflict in _find_conflicts(simulations, route_offsets)]
    return conflicts


def _get_simulations(timetable) -> List[Simulation]:
    simulations = list()
    schedules = timetable.train_schedules.all()
    for schedule in schedules:
        if schedule.eco_simulation is not None:
            sim = schedule.eco_simulation
        else:
            sim = schedule.base_simulation
        simulations.append(
            Simulation(sim["route_occupancies"], TrainData(schedule.pk, schedule.train_name, schedule.departure_time))
        )
    return simulations


def _make_route_offsets(path: PathPayload) -> Dict[str, RouteOffsets]:
    res: Dict[str, RouteOffsets] = {}
    start_pos = 0
    for route_path in path.route_paths:
        route_id = route_path.route
        end_pos = start_pos
        for track_range in route_path.track_sections:
            end_pos += track_range.length()
        res[route_id] = RouteOffsets(start_pos, end_pos)
        start_pos = end_pos
    return res


def _find_conflicts(simulations: List[Simulation], route_offsets: Dict[str, RouteOffsets]) -> Set[Conflict]:
    conflicts = set()

    routes_usage = defaultdict(list)
    for sim in simulations:
        for route_id, occupancy in sim.route_occupation.items():
            routes_usage[route_id].append(
                RouteUse(
                    sim.train_data,
                    occupancy["time_head_occupy"] + sim.train_data.departure_time,
                    occupancy["time_tail_free"] + sim.train_data.departure_time,
                )
            )

    for route in routes_usage:
        route_uses = routes_usage[route]
        route_uses.sort(key=lambda s: s.time_start)
        for first, second in zip(route_uses[:-1], route_uses[1:]):
            if first.time_end > second.time_start:
                if route in route_offsets:
                    position_start = route_offsets[route].start
                    position_end = route_offsets[route].end
                else:
                    continue  # Temporary workaround to have partial results: we only consider conflicts on the path
                    # see https://github.com/DGEXSolutions/osrd/discussions/1121

                    # position_start = None
                    # position_end = None
                conflict = Conflict(
                    first.train_data,
                    second.train_data,
                    second.time_start,
                    min(first.time_end, second.time_end),
                    position_start,
                    position_end,
                )
                if position_start is not None and conflict in conflicts:
                    # In case of duplicate, keep the one with the most information
                    conflicts.remove(conflict)
                conflicts.add(conflict)

    return conflicts
