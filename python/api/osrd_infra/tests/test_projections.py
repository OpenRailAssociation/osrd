from unittest import TestCase

from osrd_schemas.infra import Direction, DirectionalTrackRange, Identifier
from osrd_schemas.path import PathPayload, RoutePath

from osrd_infra.views.projection import Projection


class TestProjections(TestCase):
    def setUp(self):
        self.first_route = RoutePath(
            route=Identifier("route_1"),
            track_sections=[
                DirectionalTrackRange(
                    track=Identifier("track_1"), begin=100, end=1000, direction=Direction.START_TO_STOP
                ),
                DirectionalTrackRange(track=Identifier("track_2"), begin=0, end=500, direction=Direction.START_TO_STOP),
            ],
            signaling_type="BAL3",
        )
        self.second_route = RoutePath(
            route=Identifier("route_2"),
            track_sections=[
                DirectionalTrackRange(
                    track=Identifier("track_2"), begin=500, end=1000, direction=Direction.START_TO_STOP
                ),
                DirectionalTrackRange(
                    track=Identifier("track_3"), begin=500, end=1000, direction=Direction.STOP_TO_START
                ),
                DirectionalTrackRange(track=Identifier("track_3"), begin=0, end=500, direction=Direction.STOP_TO_START),
            ],
            signaling_type="BAL3",
        )
        self.simple_path_payload = PathPayload(
            route_paths=[
                self.first_route,
                self.second_route,
            ],
            path_waypoints=[],
        )
        self.simple_projection = Projection(self.simple_path_payload)

    def test_project_path_on_itself(self):
        res = self.simple_projection.intersections(self.simple_path_payload)
        assert len(res) == 1
        assert res[0].begin.path_offset == 0
        assert res[0].end.path_offset == self.simple_projection.length

    def test_project_first_route(self):
        res = self.simple_projection.intersections(
            PathPayload(
                route_paths=[self.first_route],
                path_waypoints=[],
            )
        )
        assert len(res) == 1
        assert res[0].begin.path_offset == 0
        assert res[0].end.path_offset == 1400
        assert res[0].end.offset == 500
        assert res[0].end.track == "track_2"

    def test_project_second_route(self):
        res = self.simple_projection.intersections(
            PathPayload(
                route_paths=[self.second_route],
                path_waypoints=[],
            )
        )
        assert len(res) == 1
        assert res[0].begin.path_offset == 0
        assert res[0].end.path_offset == self.simple_projection.length - 1400
        assert res[0].begin.offset == 500
        assert res[0].begin.track == "track_2"

    def test_long_path_on_short_projection(self):
        projection = Projection(
            PathPayload(
                route_paths=[self.first_route],
                path_waypoints=[],
            )
        )
        res = projection.intersections(
            PathPayload(
                route_paths=[self.first_route, self.second_route],
                path_waypoints=[],
            )
        )
        assert len(res) == 1
        assert res[0].begin.path_offset == 0
        assert res[0].end.path_offset == projection.length
        assert res[0].end.offset == 500
        assert res[0].end.track == "track_2"

    def test_long_path_on_short_projection_inverted(self):
        projection = Projection(
            PathPayload(
                route_paths=[self.second_route],
                path_waypoints=[],
            )
        )
        res = projection.intersections(
            PathPayload(
                route_paths=[self.first_route, self.second_route],
                path_waypoints=[],
            )
        )
        assert len(res) == 1
        assert res[0].begin.path_offset == 1400
        assert res[0].end.path_offset == self.simple_projection.length
        assert res[0].begin.offset == 500
        assert res[0].begin.track == "track_2"
