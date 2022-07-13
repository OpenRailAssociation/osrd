import json
from pathlib import Path

from django.core.management.base import BaseCommand
from geojson_pydantic import LineString, Point

from osrd_infra.models import Infra, RollingStock
from osrd_infra.schemas.infra import (
    ApplicableDirections,
    BufferStop,
    Direction,
    DirectionalTrackRange,
    Route,
    TrackSection,
)


class Command(BaseCommand):
    help = "Generates a basic DB setup for unit tests"

    def handle(self, *args, **options):
        existing = RollingStock.objects.filter(name="fast_rolling_stock").first()
        if existing is not None:
            existing.delete()
        rolling_stock_path = Path(__file__).parents[3] / "static" / "example_rolling_stock.json"
        with open(rolling_stock_path.resolve(), "r") as f:
            RollingStock.from_railjson(json.load(f))

        infra = Infra.objects.create(
            name="dummy_infra",
            owner="00000000-0000-0000-0000-000000000000",
        )

        # Create a simple track section
        track_section = TrackSection(
            id="track.1",
            length=1000,
            line_code=42,
            line_name="foo",
            track_number=43,
            track_name="track",
            navigability=ApplicableDirections.BOTH,
            slopes=[],
            curves=[],
            speed_sections=[],
            catenary_sections=[],
            signaling_sections=[],
            geo=LineString(coordinates=[(0, 0), (1, 1)]),
            sch=LineString(coordinates=[(0, 0), (1, 1)]),
        )
        track_section.into_model(infra).save()

        # Create two buffer stops
        waypoints = []
        for position in (0, 1000):
            bf = BufferStop(
                id=f"bf.{position}",
                applicable_directions=ApplicableDirections.BOTH,
                track=track_section.ref(),
                position=position,
                geo=Point(coordinates=(position, position)),
                sch=Point(coordinates=(position, position)),
            )
            bf.into_model(infra).save()
            waypoints.append(bf)

        # Create route
        route = Route(
            id="route.1",
            entry_point=waypoints[0].ref(),
            exit_point=waypoints[1].ref(),
            release_detectors=[],
            path=[
                DirectionalTrackRange(track=track_section.ref(), begin=0, end=1000, direction=Direction.START_TO_STOP)
            ],
            geo=LineString(coordinates=[(0, 0), (1, 1)]),
            sch=LineString(coordinates=[(0, 0), (1, 1)]),
        )
        route.into_model(infra).save()
        print(infra.id)
