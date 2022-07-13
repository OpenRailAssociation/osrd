from typing import List, Optional

from geojson_pydantic import Point
from pydantic import BaseModel, Field

from osrd_infra.schemas.infra import (
    DirectionalTrackRange,
    ObjectReference,
    TrackLocationTrait,
)


class GeometryPointTrait(BaseModel):
    """This class is used as an input to define coordinates of differents points present on the path."""

    geo: Point = Field(description="Geometric coordinates of a point")
    sch: Point = Field(description="Schematic coordinates of a point")


class RoutePath(BaseModel):
    """This class is used like a list to define a route of path.
    The path is in fact a list of several route paths."""

    route: ObjectReference = Field(description="Identifier and type of the corresponding route")
    track_sections: List[DirectionalTrackRange] = Field(
        description="Identifier,type,,direction, begin and end offset of the corresponding track section"
    )
    signaling_type: str = Field(description="Type of signalisation like BAL3 for instance")


class PathWaypoint(GeometryPointTrait, TrackLocationTrait):
    """This class is used to characterize each point of the path.
    Each point is defined with its coordinates (schematic or geometric), and its corresponding track."""

    name: Optional[str] = Field(description="Name of the point")
    suggestion: bool
    duration: float = Field(description="Duration in seconds of the stop if there is a stop at this point", ge=0)


class PathPayload(BaseModel):
    """This class is used to define the whole path."""

    route_paths: List[RoutePath] = Field(description="List of the path divided into routes that it follows")
    path_waypoints: List[PathWaypoint] = Field(description="List of differents points taken on the path")


class SlopePoint(BaseModel):
    """This class is used to characterize each available slope of the path."""

    position: float = Field(description="Position in meters of the corresponding slope", ge=0)
    gradient: float = Field(description="Gradient in meters per kilometers corresponding at the position of the path")


class Slopes(BaseModel):
    """This class simply gathers all the information concerning the slope of the path in a list"""

    __root__: List[SlopePoint] = Field(description="List of all slopes of the path")


class CurvePoint(BaseModel):
    """This class is used to characterize each available curve of the path."""

    position: float = Field(description="Position in meters of the corresponding curve", ge=0)
    radius: float = Field(description="Radius in meters corresponding at the position of the path", ge=0)


class Curves(BaseModel):
    """This class simply gathers all the information concerning the curve of the path in a list"""

    __root__: List[CurvePoint] = Field(description="List of all curves of the path")
