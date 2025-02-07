from railjson_generator.infra_builder import InfraBuilder
from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.endpoint import Endpoint, TrackEndpoint
from railjson_generator.schema.infra.infra import Infra
from railjson_generator.schema.infra.route import Route
from railjson_generator.schema.infra.signal import Signal
from railjson_generator.schema.infra.switch import Switch, SwitchGroup
from railjson_generator.schema.infra.track_section import TrackSection
from railjson_generator.schema.infra.waypoint import BufferStop, Detector
from railjson_generator.utils.routes_generator import (
    DetectorProps,
    IncompleteRoute,
    ZonePath,
    ZonePathStep,
    find_detector_properties,
    follow_track_link,
    generate_route_paths,
    generate_routes,
    search_zone_paths,
)


def test_follow_track_link_empty():
    assert follow_track_link([]) is None


def test_follow_track_link_switch():
    ts = TrackSection(length=1)
    endpoint = Endpoint.BEGIN
    te = TrackEndpoint(ts, endpoint)
    switch = Switch()
    switch_group = SwitchGroup(switch, "group")

    next_te = follow_track_link([(te, switch_group)])

    assert next_te is None


def test_follow_track_link():
    ts = TrackSection(length=1)
    endpoint = Endpoint.BEGIN
    te = TrackEndpoint(ts, endpoint)

    next_te = follow_track_link([(te, None)])

    assert next_te == te


def test_find_detector_properties_empty():
    infra = Infra()

    assert find_detector_properties(infra) == {}


def test_find_detector_properties():
    #   bs0======det======bs1
    #       s025>    <s075
    bs0 = BufferStop(0)
    bs1 = BufferStop(1)
    det = Detector(0.5)
    s025 = Signal(
        position=0.25, direction=Direction.START_TO_STOP, is_route_delimiter=False
    )
    s075 = Signal(
        position=0.75, direction=Direction.STOP_TO_START, is_route_delimiter=False
    )
    ts = TrackSection(length=1, waypoints=[bs0, det, bs1], signals=[s025, s075])
    infra = Infra(track_sections=[ts])
    default_dp = DetectorProps(
        incr_is_route_delim=False,
        incr_signals=[],
        decr_is_route_delim=False,
        decr_signals=[],
    )

    dps = find_detector_properties(infra)

    assert dps == {
        bs0.label: default_dp,
        bs1.label: default_dp,
        det.label: DetectorProps(
            incr_is_route_delim=False,
            incr_signals=[s025],
            decr_is_route_delim=False,
            decr_signals=[s075],
        ),
    }


class TestZonePathStep:
    def test_build(self):
        ib = InfraBuilder()
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
        ib.build()
        zps = ZonePathStep(
            y,
            Direction.START_TO_STOP,
            SwitchGroup(switch, "group"),
            ZonePathStep(x, Direction.START_TO_STOP),
        )

        zp = zps.build(
            x.waypoints[0],
            Direction.START_TO_STOP,
            y.waypoints[-1],
            Direction.START_TO_STOP,
        )

        assert zp == ZonePath(
            x.waypoints[0],
            Direction.START_TO_STOP,
            y.waypoints[-1],
            Direction.START_TO_STOP,
            {switch.label: "group"},
        )


def test_search_zone_paths():
    ib = InfraBuilder()
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
    infra = ib.build()

    zps = search_zone_paths(infra)

    assert len(zps) == 4
    xy = ZonePath(
        x.waypoints[0],
        Direction.START_TO_STOP,
        y.waypoints[-1],
        Direction.START_TO_STOP,
        {switch.label: "A_B1"},
    )
    assert xy in zps
    yx = ZonePath(
        y.waypoints[-1],
        Direction.STOP_TO_START,
        x.waypoints[0],
        Direction.STOP_TO_START,
        {switch.label: "A_B1"},
    )
    assert yx in zps
    xz = ZonePath(
        x.waypoints[0],
        Direction.START_TO_STOP,
        z.waypoints[-1],
        Direction.START_TO_STOP,
        {switch.label: "A_B2"},
    )
    assert xz in zps
    zx = ZonePath(
        z.waypoints[-1],
        Direction.STOP_TO_START,
        x.waypoints[0],
        Direction.STOP_TO_START,
        {switch.label: "A_B2"},
    )
    assert zx in zps


class TestIncompleteRoute:
    def test_from_zonepath(self):
        ib = InfraBuilder()
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
        ib.build()
        xy = ZonePath(
            x.waypoints[0],
            Direction.START_TO_STOP,
            y.waypoints[-1],
            Direction.START_TO_STOP,
            {switch.label: "A_B1"},
        )

        ir = IncompleteRoute.from_zonepath(xy)

        assert ir == IncompleteRoute(
            path=[xy], switches_directions={switch.label: "A_B1"}
        )

    def test_fork_overlap(self):
        ib = InfraBuilder()
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
        ib.build()
        xy = ZonePath(
            x.waypoints[0],
            Direction.START_TO_STOP,
            y.waypoints[-1],
            Direction.START_TO_STOP,
            {switch.label: "A_B1"},
        )
        xz = ZonePath(
            x.waypoints[0],
            Direction.START_TO_STOP,
            z.waypoints[-1],
            Direction.START_TO_STOP,
            {switch.label: "A_B2"},
        )
        ir = IncompleteRoute.from_zonepath(xy)

        assert ir.fork(xz) is None

    def test_fork(self):
        ib = InfraBuilder()
        #     x        y       z
        # ======d1=o=====d2=o=======
        x = ib.add_track_section(length=1)
        x.add_detector(position=0.75)
        y = ib.add_track_section(length=1)
        y.add_detector(position=0.75)
        link_xy = ib.add_link(x.end(), y.begin())
        z = ib.add_track_section(length=1)
        link_yz = ib.add_link(y.end(), z.begin())
        ib.build()
        xy = ZonePath(
            x.waypoints[0],
            Direction.START_TO_STOP,
            y.waypoints[-1],
            Direction.START_TO_STOP,
            {link_xy.label: "STATIC"},
        )
        yz = ZonePath(
            y.waypoints[0],
            Direction.START_TO_STOP,
            z.waypoints[-1],
            Direction.START_TO_STOP,
            {link_yz.label: "STATIC"},
        )
        ir = IncompleteRoute.from_zonepath(xy)

        ir = ir.fork(yz)

        assert ir == IncompleteRoute(
            path=[xy, yz],
            switches_directions={link_xy.label: "STATIC", link_yz.label: "STATIC"},
        )

    def test_dir_waypoints(self):
        ib = InfraBuilder()
        #     x        y       z
        # ======d1=o=====d2=o=======
        x = ib.add_track_section(length=1)
        x.add_detector(position=0.75)
        y = ib.add_track_section(length=1)
        y.add_detector(position=0.75)
        link_xy = ib.add_link(x.end(), y.begin())
        z = ib.add_track_section(length=1)
        link_yz = ib.add_link(y.end(), z.begin())
        ib.build()
        xy = ZonePath(
            x.waypoints[0],
            Direction.START_TO_STOP,
            y.waypoints[-1],
            Direction.START_TO_STOP,
            {link_xy.label: "STATIC"},
        )
        yz = ZonePath(
            y.waypoints[0],
            Direction.START_TO_STOP,
            z.waypoints[-1],
            Direction.START_TO_STOP,
            {link_yz.label: "STATIC"},
        )
        ir = IncompleteRoute.from_zonepath(xy)
        ir = ir.fork(yz)
        assert ir is not None

        dir_waypoints = ir.dir_waypoints()

        assert dir_waypoints == [
            (x.waypoints[0], Direction.START_TO_STOP),
            (y.waypoints[-1], Direction.START_TO_STOP),
            (z.waypoints[-1], Direction.START_TO_STOP),
        ]

    def test_waypoints(self):
        ib = InfraBuilder()
        #     x        y       z
        # ======d1=o=====d2=o=======
        x = ib.add_track_section(length=1)
        x.add_detector(position=0.75)
        y = ib.add_track_section(length=1)
        y.add_detector(position=0.75)
        link_xy = ib.add_link(x.end(), y.begin())
        z = ib.add_track_section(length=1)
        link_yz = ib.add_link(y.end(), z.begin())
        ib.build()
        xy = ZonePath(
            x.waypoints[0],
            Direction.START_TO_STOP,
            y.waypoints[-1],
            Direction.START_TO_STOP,
            {link_xy.label: "STATIC"},
        )
        yz = ZonePath(
            y.waypoints[0],
            Direction.START_TO_STOP,
            z.waypoints[-1],
            Direction.START_TO_STOP,
            {link_yz.label: "STATIC"},
        )
        ir = IncompleteRoute.from_zonepath(xy)
        ir = ir.fork(yz)
        assert ir is not None

        waypoints = ir.waypoints()

        assert waypoints == [x.waypoints[0], y.waypoints[-1], z.waypoints[-1]]


def test_generate_route_paths():
    ib = InfraBuilder()
    # Possible routes are x->y, x->z, and mirrors.
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
    infra = ib.build()
    zps = search_zone_paths(infra)
    dps = find_detector_properties(infra)

    routes = list(generate_route_paths(dps, zps))

    assert len(routes) == 4
    xy = IncompleteRoute(
        path=[
            ZonePath(
                x.waypoints[0],
                Direction.START_TO_STOP,
                y.waypoints[-1],
                Direction.START_TO_STOP,
                {switch.label: "A_B1"},
            )
        ],
        switches_directions={switch.label: "A_B1"},
    )
    assert xy in routes
    yx = IncompleteRoute(
        path=[
            ZonePath(
                y.waypoints[-1],
                Direction.STOP_TO_START,
                x.waypoints[0],
                Direction.STOP_TO_START,
                {switch.label: "A_B1"},
            )
        ],
        switches_directions={switch.label: "A_B1"},
    )
    assert yx in routes
    xz = IncompleteRoute(
        path=[
            ZonePath(
                x.waypoints[0],
                Direction.START_TO_STOP,
                z.waypoints[-1],
                Direction.START_TO_STOP,
                {switch.label: "A_B2"},
            )
        ],
        switches_directions={switch.label: "A_B2"},
    )
    assert xz in routes
    zx = IncompleteRoute(
        path=[
            ZonePath(
                z.waypoints[-1],
                Direction.STOP_TO_START,
                x.waypoints[0],
                Direction.STOP_TO_START,
                {switch.label: "A_B2"},
            )
        ],
        switches_directions={switch.label: "A_B2"},
    )
    assert zx in routes


def test_generate_routes_without_progressive_release():
    ib = InfraBuilder()
    # Possible routes are x->y, x->z, and mirrors.
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
    infra = ib.build()

    routes = list(generate_routes(infra, progressive_release=False))

    assert len(routes) == 4
    # Careful, Route.__eq__ only compares labels.
    routes_rjs = [r.to_rjs() for r in routes]
    xy = Route(
        waypoints=[x.waypoints[0], y.waypoints[-1]],
        release_waypoints=[],
        entry_point_direction=Direction.START_TO_STOP,
        switches_directions={switch.label: "A_B1"},
    ).to_rjs()
    assert xy in routes_rjs
    yx = Route(
        waypoints=[y.waypoints[-1], x.waypoints[0]],
        release_waypoints=[],
        entry_point_direction=Direction.STOP_TO_START,
        switches_directions={switch.label: "A_B1"},
    ).to_rjs()
    assert yx in routes_rjs
    xz = Route(
        waypoints=[x.waypoints[0], z.waypoints[-1]],
        release_waypoints=[],
        entry_point_direction=Direction.START_TO_STOP,
        switches_directions={switch.label: "A_B2"},
    ).to_rjs()
    assert xz in routes_rjs
    zx = Route(
        waypoints=[z.waypoints[-1], x.waypoints[0]],
        release_waypoints=[],
        entry_point_direction=Direction.STOP_TO_START,
        switches_directions={switch.label: "A_B2"},
    ).to_rjs()
    assert zx in routes_rjs


def test_generate_routes():
    ib = InfraBuilder()
    # Possible routes are x->z, and z->x.
    #     x        y       z
    # ======d1=o=====d2=o=======
    x = ib.add_track_section(length=1)
    x.add_detector(position=0.75)
    y = ib.add_track_section(length=1)
    y.add_detector(position=0.75)
    link_xy = ib.add_link(x.end(), y.begin())
    z = ib.add_track_section(length=1)
    link_yz = ib.add_link(y.end(), z.begin())
    ib.build()

    routes = list(generate_routes(ib.infra, progressive_release=True))

    assert len(routes) == 2
    # Careful, Route.__eq__ only compares labels.
    routes_rjs = [r.to_rjs() for r in routes]
    xz = Route(
        waypoints=[x.waypoints[0], z.waypoints[-1]],
        release_waypoints=[x.waypoints[-1], y.waypoints[-1]],
        entry_point_direction=Direction.START_TO_STOP,
        switches_directions={link_xy.label: "STATIC", link_yz.label: "STATIC"},
    ).to_rjs()
    assert xz in routes_rjs
    zx = Route(
        waypoints=[z.waypoints[-1], x.waypoints[0]],
        release_waypoints=[y.waypoints[-1], x.waypoints[-1]],
        entry_point_direction=Direction.STOP_TO_START,
        switches_directions={link_xy.label: "STATIC", link_yz.label: "STATIC"},
    ).to_rjs()
    assert zx in routes_rjs
