from .infra import SwitchType

POINT_SWITCH: SwitchType = SwitchType.new(
    "point_switch", ["A", "B1", "B2"], {"A_B2": [{"src": "A", "dst": "B2"}], "A_B1": [{"src": "A", "dst": "B1"}]}
)

LINK: SwitchType = SwitchType.new("link", ["A", "B"], {"STATIC": [{"src": "A", "dst": "B"}]})
CROSSING: SwitchType = SwitchType.new(
    "crossing", ["A1", "B1", "A2", "B2"], {"STATIC": [{"src": "A1", "dst": "B1"}, {"src": "A2", "dst": "B2"}]}
)

SINGLE_SLIP_SWITCH: SwitchType = SwitchType.new(
    "single_slip_switch",
    ["A1", "B1", "A2", "B2"],
    {
        "STATIC": [{"src": "A1", "dst": "B1"}, {"src": "A2", "dst": "B2"}],
        "A1_B2": [{"src": "A1", "dst": "B2"}],
    },
)

DOUBLE_SLIP_SWITCH: SwitchType = SwitchType.new(
    "double_slip_switch",
    ["A1", "B1", "A2", "B2"],
    {
        "A1_B1": [{"src": "A1", "dst": "B1"}],
        "A1_B2": [{"src": "A1", "dst": "B2"}],
        "A2_B1": [{"src": "A2", "dst": "B1"}],
        "A2_B2": [{"src": "A2", "dst": "B2"}],
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
