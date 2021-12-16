from typing import List, Optional

from pydantic import BaseModel

from osrd_infra.schemas.infra import (
    DirectionalTrackRange,
    GeometryPointTrait,
    ObjectReference,
    TrackLocationTrait,
)


class PathStep(BaseModel):
    route: ObjectReference
    track_sections: List[DirectionalTrackRange]


class Step(GeometryPointTrait, TrackLocationTrait):
    name: Optional[str]
    suggestion: bool
    stop_time: float


class PathPayload(BaseModel):
    path: List[PathStep]
    steps: List[Step]


class VmaxPoint(BaseModel):
    position: float
    speed: float


class Vmax(BaseModel):
    __root__: List[VmaxPoint]


class SlopePoint(BaseModel):
    position: float
    gradient: float


class Slopes(BaseModel):
    __root__: List[SlopePoint]


class CurvePoint(BaseModel):
    position: float
    radius: float


class Curves(BaseModel):
    __root__: List[CurvePoint]
