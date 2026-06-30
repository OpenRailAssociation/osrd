from .models import Port, SwitchPortConnection, SwitchType

POINT_SWITCH: SwitchType = SwitchType(
    id="point_switch",
    ports=[Port("A"), Port("B1"), Port("B2")],
    groups={
        "A_B2": [SwitchPortConnection(src="A", dst="B2")],
        "A_B1": [SwitchPortConnection(src="A", dst="B1")],
    },
)

LINK: SwitchType = SwitchType(
    id="link",
    ports=[Port("A"), Port("B")],
    groups={"STATIC": [SwitchPortConnection(src="A", dst="B")]},
)

CROSSING: SwitchType = SwitchType(
    id="crossing",
    ports=[Port("A1"), Port("B1"), Port("A2"), Port("B2")],
    groups={
        "STATIC": [
            SwitchPortConnection(src="A1", dst="B1"),
            SwitchPortConnection(src="A2", dst="B2"),
        ]
    },
)

SINGLE_SLIP_SWITCH: SwitchType = SwitchType(
    id="single_slip_switch",
    ports=[Port("A1"), Port("B1"), Port("A2"), Port("B2")],
    groups={
        "STATIC": [
            SwitchPortConnection(src="A1", dst="B1"),
            SwitchPortConnection(src="A2", dst="B2"),
        ],
        "A1_B2": [SwitchPortConnection(src="A1", dst="B2")],
    },
)

DOUBLE_SLIP_SWITCH: SwitchType = SwitchType(
    id="double_slip_switch",
    ports=[Port("A1"), Port("B1"), Port("A2"), Port("B2")],
    groups={
        "A1_B1": [SwitchPortConnection(src="A1", dst="B1")],
        "A1_B2": [SwitchPortConnection(src="A1", dst="B2")],
        "A2_B1": [SwitchPortConnection(src="A2", dst="B1")],
        "A2_B2": [SwitchPortConnection(src="A2", dst="B2")],
    },
)


def builtin_node_types():
    result = {}
    for sw in [LINK, POINT_SWITCH, CROSSING, SINGLE_SLIP_SWITCH, DOUBLE_SLIP_SWITCH]:
        result[sw.id] = {
            "ports": [p.root for p in sw.ports],
            "groups": {
                gid: [{"src": c.src, "dst": c.dst} for c in conns]
                for gid, conns in sw.groups.items()
            },
        }
    return result
