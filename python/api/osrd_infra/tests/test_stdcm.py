import json

import mock
from django.test import TestCase

from osrd_infra.models import (
    Infra,
    RollingStock,
    Timetable,
    TrackSectionModel,
    TrainScheduleModel,
)
from osrd_infra.views.stdcm import compute_stdcm


def make_dummy_linestring():
    return {"type": "LineString", "coordinates": [[0, 1], [0, 1]]}


def mock_api_call(payload):
    sim = [
        {
            "speeds": [{"time": 0}, {"time": 100}],
            "head_positions": [
                {"time": 0, "track_section": "track", "offset": 0, "path_offset": 0},
                {"time": 100, "track_section": "track", "offset": 100, "path_offset": 100},
            ],
            "stops": [],
            "route_occupancies": {},
            "signal_updates": {},
            "mechanical_energy_consumed": 20011,
        }
    ]
    return {
        "path": {
            "route_paths": [
                {
                    "route": "route_1",
                    "signaling_type": "BAL3",
                    "track_sections": [
                        {
                            "track": "track",
                            "begin": 0,
                            "end": 100,
                            "direction": "START_TO_STOP",
                        }
                    ],
                }
            ],
            "path_waypoints": [],
            "geographic": make_dummy_linestring(),
            "schematic": make_dummy_linestring(),
        },
        "simulation": {
            "base_simulations": sim,
            "eco_simulations": sim,
            "speed_limits": [[]],
            "modes_and_profiles": [[]],
        },
        "departure_time": 0,
    }


class STDCMTestCase(TestCase):
    def setUp(self):
        self.infra = Infra.objects.create()
        self.timetable = Timetable.objects.create()
        self.track = TrackSectionModel.objects.create(
            infra=self.infra,
            data={
                "sch": make_dummy_linestring(),
                "geo": make_dummy_linestring(),
                "id": "track",
                "length": 100,
                "curves": [],
                "slopes": [],
            },
            obj_id="track",
        )
        self.rolling_stock = RollingStock.import_railjson(json.load(open("static/example_rolling_stock.json")))
        self.schedule = TrainScheduleModel.objects.create(
            timetable=self.timetable,
            base_simulation={},
            departure_time=0,
            initial_speed=0,
            mrsp=[],
            rolling_stock=self.rolling_stock,
            eco_simulation={},
        )

    @mock.patch("osrd_infra.views.stdcm.request_stdcm", side_effect=mock_api_call)
    def test_stdcm_single_train(self, mock):
        self.schedule.eco_simulation["route_occupancies"] = {
            "route_1": {"time_head_occupy": 0, "time_tail_free": 42},
            "route_2": {"time_head_occupy": 21, "time_tail_free": 63},
        }
        self.schedule.save()
        result = compute_stdcm(
            {
                "infra": self.infra,
                "rolling_stock": self.rolling_stock,
                "comfort": "standard",
                "timetable": self.timetable,
                "start_time": 0,
                "start_points": [{"track_section": "track", "offset": 0}],
                "end_points": [{"track_section": "track", "offset": 100}],
            },
            42,
        )

        # Check the payload sent to the core
        request_payload = mock.call_args[0][0]
        expected_occupancies = [
            {
                "id": "route_1",
                "start_occupancy_time": 0,
                "end_occupancy_time": 42,
            },
            {
                "id": "route_2",
                "start_occupancy_time": 21,
                "end_occupancy_time": 63,
            },
        ]
        assert expected_occupancies == request_payload["route_occupancies"]
        assert self.infra.pk == request_payload["infra"]
        assert self.rolling_stock.name == request_payload["rolling_stock"]["name"]
        assert 0 == request_payload["start_time"]
        assert "end_time" not in request_payload

        # Check the result
        assert make_dummy_linestring() == result["path"]["geographic"]
        assert [{"time": 0}, {"time": 100}] == result["simulation"]["base"]["speeds"]
