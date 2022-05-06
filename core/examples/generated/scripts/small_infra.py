import enum
from railjson_generator import (
    InfraBuilder,
    SimulationBuilder,
    ApplicableDirection,
    Location,
)
from math import dist
from typing import List

# from lib.railjson_generator.schema.infra.track_section import TrackSection


# black line in the schema
line_1 = [
    [-0.4, 49.5],
    [-0.36, 49.5],
    [-0.15, 49.5],
    [-0.145, 49.5025],
    [-0.145, 49.507],
    [-0.15, 49.51],
    [-0.165, 49.51],
    [-0.172, 49.507],
    [-0.172, 49.5],
    [-0.172, 49.498],
    [-0.172, 49.47],
    [-0.167, 49.466],
    [-0.135, 49.466],
]

# green line
line_2 = [
    [-0.4, 49.498],
    [-0.365, 49.498],
    [-0.172, 49.498],
    [-0.137, 49.498],
    [-0.135, 49.499],
    [-0.133, 49.498],
    [-0.12, 49.498],
    [-0.115, 49.495],
    [-0.115, 49.487],
    [-0.11, 49.484],
    [-0.09, 49.484],
]

# orange line
line_3 = [[-0.4, 49.496], [-0.37, 49.496], [-0.365, 49.498], [-0.36, 49.5]]

# red line
line_4 = [[-0.4, 49.49], [-0.373, 49.49], [-0.37, 49.492], [-0.37, 49.496]]

# purple line
line_5 = [
    [-0.15, 49.5],
    [-0.137, 49.5],
    [-0.135, 49.499],
    [-0.133, 49.5],
    [-0.12, 49.5],
    [-0.115, 49.503],
    [-0.115, 49.51],
    [-0.11, 49.513],
    [-0.09, 49.513],
]


builder = InfraBuilder()

TRACK_SECTIONS_COORDINATES = [
    line_1[0:2],
    line_2[0:2],
    line_3[0:2],
    line_4,
    line_3[1:3],
    line_3[2:4],
    line_1[1:3],
    line_2[1:3],
    line_1[9:11],
    line_1[3:10],
    line_1[2:4],
    line_2[2:5],
    line_1[10:],
    line_5[0:3],
    line_5[2:],
    line_2[4:],
]


track_sections = []
for i, ts_coordinates in enumerate(TRACK_SECTIONS_COORDINATES):
    track_sections.append(
        builder.add_track_section(
            length=sum(
                [
                    dist(ts_coordinates[i], ts_coordinates[i + 1])
                    for i in range(len(ts_coordinates) - 1)
                ]
            ),
            label=f"T{i}",
            coordinates=ts_coordinates,
        )
    )

point_0 = builder.add_point_switch(
    track_sections[6].begin(), track_sections[5].end(), track_sections[0].end()
)
point_1 = builder.add_double_cross_switch(
    track_sections[7].begin(),
    track_sections[5].begin(),
    track_sections[1].end(),
    track_sections[4].end(),
)
point_2 = builder.add_point_switch(
    track_sections[4].begin(), track_sections[2].end(), track_sections[3].end()
)
point_3 = builder.add_cross_switch(
    track_sections[9].end(),
    track_sections[8].begin(),
    track_sections[6].end(),
    track_sections[10].begin(),
)
point_4 = builder.add_cross_switch(
    track_sections[8].end(),
    track_sections[12].end(),
    track_sections[7].end(),
    track_sections[11].begin(),
)
point_5 = builder.add_point_switch(
    track_sections[10].end(), track_sections[9].begin(), track_sections[13].begin()
)
point_6 = builder.add_double_cross_switch(
    track_sections[14].begin(),
    track_sections[15].begin(),
    track_sections[13].end(),
    track_sections[11].end(),
)

# Build infra
infra = builder.build()

# Save railjson
infra.save("infra.json")
