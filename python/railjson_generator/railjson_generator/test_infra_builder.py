import pytest

from railjson_generator.infra_builder import InfraBuilder
from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.neutral_section import NeutralSection
from railjson_generator.schema.infra.operational_point import OperationalPoint
from railjson_generator.schema.infra.route import Route
from railjson_generator.schema.infra.speed_section import SpeedSection
from railjson_generator.schema.infra.switch import (
    Crossing,
    DoubleSlipSwitch,
    Link,
    PointSwitch,
)
from railjson_generator.schema.infra.track_section import TrackSection
from railjson_generator.schema.infra.waypoint import BufferStop, Detector


class TestInfraBuilder:
    def test_add_track_section(self):
        ib = InfraBuilder()
        assert ib.infra.track_sections == []

        track = ib.add_track_section(length=1)

        assert track == TrackSection(index=0, length=1, label=track.label)
        assert ib.infra.track_sections == [track]

    def test_add_point_switch(self):
        ib = InfraBuilder()
        assert ib.infra.switches == []
        #     x        y
        # =========o======
        #           \=====
        #              z
        x = ib.add_track_section(length=1)
        base = x.end()
        y = ib.add_track_section(length=1)
        left = y.begin()
        z = ib.add_track_section(length=1)
        right = z.begin()

        switch = ib.add_point_switch(base, left, right)

        assert switch == PointSwitch(A=base, B1=left, B2=right, label=switch.label)
        assert ib.infra.switches == [switch]
        assert base.get_neighbors() == [
            (left, switch.group("A_B1")),
            (right, switch.group("A_B2")),
        ]
        assert left.get_neighbors() == [(base, switch.group("A_B1"))]
        assert right.get_neighbors() == [(base, switch.group("A_B2"))]

    def test_add_crossing(self):
        ib = InfraBuilder()
        assert ib.infra.switches == []
        #     w         y
        # ========\ /=======
        #          o
        # ========/ \=======
        #     x         z
        w = ib.add_track_section(length=1)
        north = w.end()
        x = ib.add_track_section(length=1)
        west = x.end()
        y = ib.add_track_section(length=1)
        east = y.begin()
        z = ib.add_track_section(length=1)
        south = z.begin()

        crossing = ib.add_crossing(north, south, east, west)

        assert crossing == Crossing(
            A1=north, B1=south, B2=east, A2=west, label=crossing.label
        )
        assert ib.infra.switches == [crossing]
        assert north.get_neighbors() == [(south, crossing.group("STATIC"))]
        assert south.get_neighbors() == [(north, crossing.group("STATIC"))]
        assert east.get_neighbors() == [(west, crossing.group("STATIC"))]
        assert west.get_neighbors() == [(east, crossing.group("STATIC"))]

    def test_add_double_slip_switch(self):
        ib = InfraBuilder()
        assert ib.infra.switches == []
        # Here, we can one can go ahead OR "turn".
        #     w         y
        # ==================
        #          o
        # ==================
        #     x         z
        w = ib.add_track_section(length=1)
        north_1 = w.end()
        x = ib.add_track_section(length=1)
        south_1 = x.end()
        y = ib.add_track_section(length=1)
        north_2 = y.begin()
        z = ib.add_track_section(length=1)
        south_2 = z.begin()

        switch = ib.add_double_slip_switch(north_1, north_2, south_1, south_2)

        assert switch == DoubleSlipSwitch(
            A1=north_1, A2=north_2, B1=south_1, B2=south_2, label=switch.label
        )
        assert ib.infra.switches == [switch]
        assert north_1.get_neighbors() == [
            (south_1, switch.group("A1_B1")),
            (south_2, switch.group("A1_B2")),
        ]
        assert north_2.get_neighbors() == [
            (south_1, switch.group("A2_B1")),
            (south_2, switch.group("A2_B2")),
        ]
        assert south_1.get_neighbors() == [
            (north_1, switch.group("A1_B1")),
            (north_2, switch.group("A2_B1")),
        ]
        assert south_2.get_neighbors() == [
            (north_1, switch.group("A1_B2")),
            (north_2, switch.group("A2_B2")),
        ]

    def test_add_link(self):
        ib = InfraBuilder()
        assert ib.infra.switches == []
        #     x        y
        # ========o========
        x = ib.add_track_section(length=1)
        source = x.end()
        y = ib.add_track_section(length=1)
        destination = y.begin()

        link = ib.add_link(source, destination)

        assert link == Link(A=source, B=destination, label=link.label)
        assert ib.infra.switches == [link]
        assert source.get_neighbors() == [(destination, link.group("STATIC"))]
        assert destination.get_neighbors() == [(source, link.group("STATIC"))]

    def test_add_operational_point(self):
        ib = InfraBuilder()
        assert ib.infra.operational_points == []

        op = ib.add_operational_point(label="label")

        assert op == OperationalPoint(label="label")
        assert ib.infra.operational_points == [op]

    def test_add_speed_section(self):
        ib = InfraBuilder()
        assert ib.infra.speed_sections == []

        ss = ib.add_speed_section(speed_limit=1)

        assert ss == SpeedSection(label=ss.label, speed_limit=1)
        assert ib.infra.speed_sections == [ss]

    def test_add_neutral_section(self):
        ib = InfraBuilder()
        assert ib.infra.neutral_sections == []

        ns = ib.add_neutral_section()

        assert ns == NeutralSection(label=ns.label)
        assert ib.infra.neutral_sections == [ns]

    def test_register_route(self):
        ib = InfraBuilder()
        assert ib.infra.routes == []
        start = BufferStop(position=0)
        stop = BufferStop(position=1)
        route = Route(
            entry_point_direction=Direction.START_TO_STOP,
            waypoints=[start, stop],
            release_waypoints=[],
        )

        ib.register_route(route)

        # Be careful, Route.__eq__ only compares labels.
        assert ib.infra.routes == [route]

    def test_generate_routes(self):
        ib = InfraBuilder()
        assert ib.infra.routes == []
        # Possible routes are x->y, x->z, and mirrors.
        #     x        y
        # ======d==o======
        #           \=====
        #              z
        detector = Detector(position=0.5)
        x = ib.add_track_section(length=1, waypoints=[detector])
        base = x.end()
        y = ib.add_track_section(length=1)
        left = y.begin()
        z = ib.add_track_section(length=1)
        right = z.begin()
        switch = ib.add_point_switch(base, left, right)

        routes = ib.generate_routes(progressive_release=True)

        assert x.waypoints[0] == BufferStop(position=0, label=x.waypoints[0].label)
        assert y.waypoints[-1] == BufferStop(position=1, label=y.waypoints[-1].label)
        assert z.waypoints[-1] == BufferStop(position=1, label=z.waypoints[-1].label)
        xy = Route(
            entry_point_direction=Direction.START_TO_STOP,
            waypoints=[x.waypoints[0], y.waypoints[-1]],
            release_waypoints=[detector],
            switches_directions={switch.label: "A_B1"},
            label=f"rt.{x.waypoints[0].label}->{y.waypoints[-1].label}",
        ).to_rjs()
        yx = Route(
            entry_point_direction=Direction.STOP_TO_START,
            waypoints=[y.waypoints[-1], x.waypoints[0]],
            release_waypoints=[detector],
            switches_directions={switch.label: "A_B1"},
            label=f"rt.{y.waypoints[-1].label}->{x.waypoints[0].label}",
        ).to_rjs()
        xz = Route(
            entry_point_direction=Direction.START_TO_STOP,
            waypoints=[x.waypoints[0], z.waypoints[-1]],
            release_waypoints=[detector],
            switches_directions={switch.label: "A_B2"},
            label=f"rt.{x.waypoints[0].label}->{z.waypoints[-1].label}",
        ).to_rjs()
        zx = Route(
            entry_point_direction=Direction.STOP_TO_START,
            waypoints=[z.waypoints[-1], x.waypoints[0]],
            release_waypoints=[detector],
            switches_directions={switch.label: "A_B2"},
            label=f"rt.{z.waypoints[-1].label}->{x.waypoints[0].label}",
        ).to_rjs()
        # Route.__eq__ only compares labels, so let's compare resulting rjs instead.
        routes = [route.to_rjs() for route in routes]
        assert len(routes) == 4
        assert xy in routes
        assert yx in routes
        assert xz in routes
        assert zx in routes

    def test_generate_routes_without_release(self):
        ib = InfraBuilder()
        assert ib.infra.routes == []
        # Possible routes are x->y, x->z, and mirrors.
        #     x        y
        # ======d==o======
        #           \=====
        #              z
        detector = Detector(position=0.5)
        x = ib.add_track_section(length=1, waypoints=[detector])
        base = x.end()
        y = ib.add_track_section(length=1)
        left = y.begin()
        z = ib.add_track_section(length=1)
        right = z.begin()
        switch = ib.add_point_switch(base, left, right)

        routes = ib.generate_routes(progressive_release=False)

        assert x.waypoints[0] == BufferStop(position=0, label=x.waypoints[0].label)
        assert y.waypoints[-1] == BufferStop(position=1, label=y.waypoints[-1].label)
        assert z.waypoints[-1] == BufferStop(position=1, label=z.waypoints[-1].label)
        xy = Route(
            entry_point_direction=Direction.START_TO_STOP,
            waypoints=[x.waypoints[0], y.waypoints[-1]],
            release_waypoints=[],
            switches_directions={switch.label: "A_B1"},
            label=f"rt.{x.waypoints[0].label}->{y.waypoints[-1].label}",
        ).to_rjs()
        yx = Route(
            entry_point_direction=Direction.STOP_TO_START,
            waypoints=[y.waypoints[-1], x.waypoints[0]],
            release_waypoints=[],
            switches_directions={switch.label: "A_B1"},
            label=f"rt.{y.waypoints[-1].label}->{x.waypoints[0].label}",
        ).to_rjs()
        xz = Route(
            entry_point_direction=Direction.START_TO_STOP,
            waypoints=[x.waypoints[0], z.waypoints[-1]],
            release_waypoints=[],
            switches_directions={switch.label: "A_B2"},
            label=f"rt.{x.waypoints[0].label}->{z.waypoints[-1].label}",
        ).to_rjs()
        zx = Route(
            entry_point_direction=Direction.STOP_TO_START,
            waypoints=[z.waypoints[-1], x.waypoints[0]],
            release_waypoints=[],
            switches_directions={switch.label: "A_B2"},
            label=f"rt.{z.waypoints[-1].label}->{x.waypoints[0].label}",
        ).to_rjs()
        # Route.__eq__ only compares labels, so let's compare resulting rjs instead.
        routes = [route.to_rjs() for route in routes]
        assert len(routes) == 4
        assert xy in routes
        assert yx in routes
        assert xz in routes
        assert zx in routes

    def test_build_with_duplicates(self):
        ib = InfraBuilder()
        track = ib.add_track_section(length=1)
        ib.add_track_section(length=1, label=track.label)

        with pytest.raises(ValueError, match="Duplicates found"):
            ib.build()

    def test_build(self):
        ib = InfraBuilder()
        # Possible routes are x->y, x->z, and mirrors.
        #     x        y
        # ======d==o======
        #           \=====
        #              z
        detector = Detector(position=0.5)
        x = ib.add_track_section(length=1, waypoints=[detector])
        base = x.end()
        y = ib.add_track_section(length=1)
        left = y.begin()
        z = ib.add_track_section(length=1)
        right = z.begin()
        switch = ib.add_point_switch(base, left, right)

        infra = ib.build()

        assert x.waypoints[0] == BufferStop(position=0, label=x.waypoints[0].label)
        assert y.waypoints[-1] == BufferStop(position=1, label=y.waypoints[-1].label)
        assert z.waypoints[-1] == BufferStop(position=1, label=z.waypoints[-1].label)
        xy = Route(
            entry_point_direction=Direction.START_TO_STOP,
            waypoints=[x.waypoints[0], y.waypoints[-1]],
            release_waypoints=[detector],
            switches_directions={switch.label: "A_B1"},
            label=f"rt.{x.waypoints[0].label}->{y.waypoints[-1].label}",
        ).to_rjs()
        yx = Route(
            entry_point_direction=Direction.STOP_TO_START,
            waypoints=[y.waypoints[-1], x.waypoints[0]],
            release_waypoints=[detector],
            switches_directions={switch.label: "A_B1"},
            label=f"rt.{y.waypoints[-1].label}->{x.waypoints[0].label}",
        ).to_rjs()
        xz = Route(
            entry_point_direction=Direction.START_TO_STOP,
            waypoints=[x.waypoints[0], z.waypoints[-1]],
            release_waypoints=[detector],
            switches_directions={switch.label: "A_B2"},
            label=f"rt.{x.waypoints[0].label}->{z.waypoints[-1].label}",
        ).to_rjs()
        zx = Route(
            entry_point_direction=Direction.STOP_TO_START,
            waypoints=[z.waypoints[-1], x.waypoints[0]],
            release_waypoints=[detector],
            switches_directions={switch.label: "A_B2"},
            label=f"rt.{z.waypoints[-1].label}->{x.waypoints[0].label}",
        ).to_rjs()
        # Route.__eq__ only compares labels, so let's compare resulting rjs instead.
        routes = [route.to_rjs() for route in infra.routes]
        assert len(routes) == 4
        assert xy in routes
        assert yx in routes
        assert xz in routes
        assert zx in routes
