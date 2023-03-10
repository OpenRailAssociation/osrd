from typing import List, Optional

from geojson_pydantic import Point
from pydantic import BaseModel, Field

from .infra import DirectionalTrackRange, Identifier, TrackLocationTrait


class GeometryPointTrait(BaseModel):
    """This class is used to define coordinates of points present on the path."""

    geo: Point = Field(description="Geographic coordinates of a point")
    sch: Point = Field(description="Schematic coordinates of a point")


class RoutePath(BaseModel):
    """This class defines the path by dividing it according to the routes it takes."""

    route: Identifier = Field(description="Reference to the corresponding route")
    track_sections: List[DirectionalTrackRange] = Field(
        description="Identifier, direction, begin and end offset of the corresponding track section"
    )
    signaling_type: str = Field(description="Type of signalisation on the corresponding route")


class PathWaypoint(GeometryPointTrait, TrackLocationTrait):
    """This class is used to characterize each waypoint of the path.
    Each waypoint is defined with its coordinates, its name, its corresponding track, its duration and its position."""

    id: Optional[str] = Field(description="Id of the operational point")
    name: Optional[str] = Field(description="Name of the operational point")
    suggestion: bool
    duration: float = Field(description="Duration in seconds of the stop if there is a stop at this point", ge=0)


class PathPayload(BaseModel):
    """This class is used to define the whole path."""

    route_paths: List[RoutePath] = Field(description="List of the path divided into routes that it follows")
    path_waypoints: List[PathWaypoint] = Field(description="List of differents waypoints taken on the path")


class SlopePoint(BaseModel):
    """This class is used to characterize each available slope of the path."""

    position: float = Field(description="Relative position in meters of the corresponding slope", ge=0)
    gradient: float = Field(description="Corresponding gradient measured in meters per kilometers")


class Slopes(BaseModel):
    """This class simply gathers all the information concerning the slope of the path in a list."""

    __root__: List[SlopePoint] = Field(description="List of all slopes of the path")


class CurvePoint(BaseModel):
    """This class is used to characterize each available curve of the path."""

    position: float = Field(description="Relative position in meters of the corresponding curve", ge=0)
    radius: float = Field(description="Corresponding radius of curvature measured in meters", ge=0)


class Curves(BaseModel):
    """This class simply gathers all the information concerning the curve of the path in a list."""

    __root__: List[CurvePoint] = Field(description="List of all curves of the path")


if __name__ == "__main__":
    print(PathPayload.schema_json(indent=2))
