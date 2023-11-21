from .infra import TrackNodePortConnection, TrackNodeType

_spc = TrackNodePortConnection.from_strs


POINT_SWITCH: TrackNodeType = TrackNodeType.from_strs(
    "point_switch", ["A", "B1", "B2"], {"A_B2": [_spc("A", "B2")], "A_B1": [_spc("A", "B1")]}
)

LINK: TrackNodeType = TrackNodeType.from_strs("link", ["A", "B"], {"STATIC": [_spc("A", "B")]})
CROSSING: TrackNodeType = TrackNodeType.from_strs(
    "crossing", ["A1", "B1", "A2", "B2"], {"STATIC": [_spc("A1", "B1"), _spc("A2", "B2")]}
)

SINGLE_SLIP_SWITCH: TrackNodeType = TrackNodeType.from_strs(
    "single_slip_switch",
    ["A1", "B1", "A2", "B2"],
    {
        "STATIC": [_spc("A1", "B1"), _spc("A2", "B2")],
        "A1_B2": [_spc("A1", "B2")],
    },
)

DOUBLE_SLIP_SWITCH: TrackNodeType = TrackNodeType.from_strs(
    "double_slip_switch",
    ["A1", "B1", "A2", "B2"],
    {
        "A1_B1": [_spc("A1", "B1")],
        "A1_B2": [_spc("A1", "B2")],
        "A2_B1": [_spc("A2", "B1")],
        "A2_B2": [_spc("A2", "B2")],
    },
)


def builtin_node_types():
    return {
        **LINK.to_dict(),
        **POINT_SWITCH.to_dict(),
        **SINGLE_SLIP_SWITCH.to_dict(),
        **DOUBLE_SLIP_SWITCH.to_dict(),
        **CROSSING.to_dict(),
    }
