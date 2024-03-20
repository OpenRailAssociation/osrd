#!/usr/bin/env python3

"""
                      T4   S4   T4bis
                    +-------+----------4 (via TD3), 4' (via TD3bis)
               TD3 /       / TD3bis
                  / S3    / S3bis
            +----+-------+-------------3
      TD2  /  T3    T3bis      T3ter
          /
         +-----------------------------2
    TD1 / S2           T2
       /
1-----+--------------------------------1'
T1   S1   T1bis

Routes and speed sections that only apply to them:

1 -> 1': 42 m/s
1 -> 2: 60 m/s
1 -> 3: 30 m/s
1 -> 4: 80 m/s
1 -> 4': 30 m/s

Other speed sections:

t1...t1bis: 50 m/s
s1..td3_t4: 40 m/s

Warning: track sections lengths are not consistent with their geometrical coordinates.
"""

from osrd_schemas.infra import Direction
from railjson_generator import InfraBuilder, get_output_dir
from railjson_generator.schema.infra.route import Route
from railjson_generator.schema.infra.track_section import TrackSection

OUTPUT_DIR = get_output_dir()


def def_coords():
    S1_LON, S1_LAT = -0.365, 49.5
    LON_DELTA, LAT_DELTA = 0.01, -0.01
    s1.set_coords(S1_LON, S1_LAT)
    s2.set_coords(S1_LON + LON_DELTA, S1_LAT - LAT_DELTA)
    s3.set_coords(S1_LON + 3 * LON_DELTA, S1_LAT - 2 * LAT_DELTA)
    s3bis.set_coords(S1_LON + 4 * LON_DELTA, S1_LAT - 2 * LAT_DELTA)
    s4.set_coords(S1_LON + 5 * LON_DELTA, S1_LAT - 3 * LAT_DELTA)

    # buffer stops
    tracks["T1"].set_remaining_coords([(S1_LON - LON_DELTA, S1_LAT)])
    end_tracks = S1_LON + 10 * LON_DELTA
    tracks["T1bis"].set_remaining_coords([(end_tracks, S1_LAT)])
    tracks["T2"].set_remaining_coords([(end_tracks, S1_LAT - LAT_DELTA)])
    tracks["T3ter"].set_remaining_coords([(end_tracks, S1_LAT - 2 * LAT_DELTA)])
    tracks["T4bis"].set_remaining_coords([(end_tracks, S1_LAT - 3 * LAT_DELTA)])

    # track links intersections
    td2_t3.set_coords(S1_LON + 2 * LON_DELTA, S1_LAT - 2 * LAT_DELTA)
    td3_t4.set_coords(S1_LON + 4 * LON_DELTA, S1_LAT - 3 * LAT_DELTA)


# GENERATE INFRA
builder = InfraBuilder()

# Create track sections

tracks: dict[str, TrackSection] = {}
for track, length in (
    ("T1", 2015),  # 2000 + 15 (detector position)
    ("T1bis", 10000),
    ("TD1", 500),
    ("T2", 9000),
    ("TD2", 500),
    ("T3", 1000),
    ("T3bis", 3000),
    ("T3ter", 4000),
    ("TD3", 500),
    ("T4", 3000),
    ("TD3bis", 500),
    ("T4bis", 3000),
):
    tracks[track] = builder.add_track_section(length=length, label=track)

# Create switches

left, right, static = "A_B1", "A_B2", "STATIC"
s1 = builder.add_point_switch(tracks["T1"].end(), tracks["TD1"].begin(), tracks["T1bis"].begin(), label="S1")
s2 = builder.add_point_switch(tracks["TD1"].end(), tracks["TD2"].begin(), tracks["T2"].begin(), label="S2")
s3 = builder.add_point_switch(tracks["T3"].end(), tracks["TD3"].begin(), tracks["T3bis"].begin(), label="S3")
s3bis = builder.add_point_switch(
    tracks["T3bis"].end(), tracks["TD3bis"].begin(), tracks["T3ter"].begin(), label="S3bis"
)
s4 = builder.add_point_switch(tracks["T4bis"].begin(), tracks["TD3bis"].end(), tracks["T4"].end(), label="S4")

# Create links

td2_t3 = builder.add_link(tracks["TD2"].end(), tracks["T3"].begin(), label="TD2_T3")
td3_t4 = builder.add_link(tracks["TD3"].end(), tracks["T4"].begin(), label="TD3_T4")

# Create buffer stops

bs1 = tracks["T1"].add_buffer_stop(position=0, label="BS1")
bs1bis, bs2, bs3ter, bs4bis = (
    tracks[track].add_buffer_stop(position=tracks[track].length, label=f"BS{track}")
    for track in (
        "T1bis",
        "T2",
        "T3ter",
        "T4bis",
    )
)

# Add an Nf signal at the begining of T1 to make a block (otherwise simulations won't work)

tracks["T1"].add_signal(
    label="SIGNAL",
    is_route_delimiter=False,
    direction=Direction.START_TO_STOP,
    position=10.0,
    installation_type="S",
).add_logical_signal("BAL", settings={"Nf": "true"})

det = tracks["T1"].add_detector(label="DETECTOR", position=15.0)

# Create the routes

routes = [
    (bs1, det, "BS1 -> DETECTOR", []),
    (det, bs1bis, "1 -> 1'", [(s1, right)]),
    (det, bs2, "1 -> 2", [(s1, left), (s2, right)]),
    (det, bs3ter, "1 -> 3", [(s1, left), (s2, left), (td2_t3, static), (s3, right), (s3bis, right)]),
    (det, bs4bis, "1 -> 4", [(s1, left), (s2, left), (td2_t3, static), (s3, left), (td3_t4, static), (s4, right)]),
    (det, bs4bis, "1 -> 4'", [(s1, left), (s2, left), (td2_t3, static), (s3, right), (s3bis, left), (s4, left)]),
]

for bs_in, bs_out, route_id, switches_directions in routes:
    builder.register_route(
        Route(
            label=route_id,
            waypoints=[bs_in, bs_out],
            entry_point_direction=Direction.START_TO_STOP,
            switches_directions={s.label: direction for s, direction in switches_directions},
            release_waypoints=[],
        )
    )

# Create speed sections

builder.add_speed_section(50, label="sp/50/t1...t1bis").add_applicable_track_ranges(
    tracks["T1"].forwards(), tracks["T1bis"].forwards()
)

builder.add_speed_section(40, label="sp/40/td1..td3_t4").add_applicable_track_ranges(
    tracks["TD1"].forwards(), tracks["TD2"].forwards(), tracks["T3"].forwards(), tracks["TD3"].forwards()
)

# Speed sections on routes

builder.add_speed_section(42, label="sp/42/1 -> 1'", on_routes=["1 -> 1'"]).add_applicable_track_ranges(
    tracks["T1"].forwards(), tracks["T1bis"].forwards()
)

builder.add_speed_section(60, label="sp/60/1 -> 2", on_routes=["1 -> 2"]).add_applicable_track_ranges(
    tracks["T1"].forwards(), tracks["TD1"].forwards(), tracks["T2"].forwards()
)

builder.add_speed_section(30, label="sp/30/1 -> 3", on_routes=["1 -> 3"]).add_applicable_track_ranges(
    tracks["T1"].forwards(),
    tracks["TD1"].forwards(),
    tracks["TD2"].forwards(),
    tracks["T3"].forwards(),
    tracks["T3bis"].forwards(),
    tracks["T3ter"].forwards(),
)

builder.add_speed_section(80, label="sp/80/1 -> 4", on_routes=["1 -> 4"]).add_applicable_track_ranges(
    tracks["T1"].forwards(),
    tracks["TD1"].forwards(),
    tracks["TD2"].forwards(),
    tracks["T3"].forwards(),
    tracks["TD3"].forwards(),
    tracks["T4"].forwards(),
    tracks["T4bis"].forwards(),
)

builder.add_speed_section(30, label="sp/30/1 -> 4'", on_routes=["1 -> 4'"]).add_applicable_track_ranges(
    tracks["T1"].forwards(),
    tracks["TD1"].forwards(),
    tracks["TD2"].forwards(),
    tracks["T3"].forwards(),
    tracks["T3bis"].forwards(),
    tracks["TD3bis"].forwards(),
    tracks["T4bis"].forwards(),
)

# Sets the coordinates of the objects

def_coords()

# Build infra
infra = builder.build()

# Save railjson
infra.save(OUTPUT_DIR / "infra.json")
