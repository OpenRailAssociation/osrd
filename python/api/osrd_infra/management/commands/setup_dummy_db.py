import json
from pathlib import Path

from django.core.management.base import BaseCommand
from geojson_pydantic import LineString, Point
from osrd_schemas.infra import (
    ApplicableDirections,
    BufferStop,
    Direction,
    Route,
    TrackSection,
)

from osrd_infra.models import Infra, RollingStock


class Command(BaseCommand):
    help = "Generates a basic DB setup for unit tests"

    def handle(self, *args, **options):
        rolling_stock_path = Path(__file__).parents[3] / "static" / "example_rolling_stock.json"
        with open(rolling_stock_path.resolve()) as f:
            RollingStock.import_railjson(json.load(f), force=True)

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
                track=track_section.id,
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
            entry_point_direction=Direction.START_TO_STOP,
            exit_point=waypoints[1].ref(),
            release_detectors=[],
            switches_directions={},
        )
        route.into_model(infra).save()
        print(infra.id)
