from heapq import heappush, heappop
import json


def write_json(filename, data):
    out = open(filename, "w")
    out.write(json.dumps(data, indent=4))
    out.close()


def write_all_files(infra, sim, succession, cbtc=True):
    write_json("config.json", CONFIG_JSON)
    write_json("infra.json", infra.to_json())
    write_json("simulation.json", sim.to_json())
    write_json("succession.json", succession.to_json())
    if cbtc:
        write_json("config_cbtc.json", CONFIG_CBTC_JSON)
        write_json("infra_cbtc.json", infra.to_json(cbtc=True))
        write_json("simulation_cbtc.json", sim.to_json(cbtc=True))


def uget_begin(track):
    return 2 * track


def uget_end(track):
    return 2 * track + 1


def oget_track(otrack):
    return otrack // 2


def oget_side(otrack):
    return "BEGIN" if otrack % 2 == 0 else "END"


def oget_direction(ofirst, osecond):
    if oget_track(ofirst) == oget_track(osecond):
        if oget_side(ofirst) == "BEGIN":
            return "NORMAL"
        else:
            return "REVERSE"
    else:
        if oget_side(ofirst) == "BEGIN":
            return "REVERSE"
        else:
            return "NORMAL"


def oget_other_side(otrack):
    return otrack ^ 1


def oname_track(otrack):
    return f"ne.micro.{oget_track(otrack)}"


def uname_track(utrack):
    return f"ne.micro.{utrack}"


def oname_switch(obase, oleft, oright):
    return f"il.switch.{oget_track(obase)}-{oget_track(oleft)}-{oget_track(oright)}"


def uname_switch(ubase, uleft, uright):
    return f"il.switch.{ubase}-{uleft}-{uright}"


def oname_tde(otrack):
    return f"tde.{oget_track(otrack)}_{oget_side(otrack)}"


def uname_tde_begin(utrack):
    return f"tde.{utrack}_BEGIN"


def uname_tde_end(utrack):
    return f"tde.{utrack}_END"


def oname_buffer_stop(otrack):
    return f"buffer_stop.{oget_track(otrack)}"


def uname_buffer_stop(utrack):
    return f"buffer_stop.{utrack}"


def uname_tvd_track(utrack):
    return f"tvd.{utrack}"


def oname_tvd_track(otrack):
    return f"tvd.{oget_track(otrack)}"


def oname_tvd_link(ofirst, osecond):
    return f"tvd.{oget_track(ofirst)}-{oget_track(osecond)}"


def uname_tvd_link(ufirst, usecond):
    return f"tvd.{ufirst}-{usecond}"


def oname_tvd_switch(obase, oleft, oright):
    return f"tvd.{oget_track(obase)}-{oget_track(oleft)}-{oget_track(oright)}"


def uname_tvd_switch(ubase, uleft, uright):
    return f"tvd.{ubase}-{uleft}-{uright}"


def oname_route_between(ofirst, osecond):
    return f"rt.{oget_track(ofirst)}_{oget_side(ofirst)}-{oget_track(osecond)}_{oget_side(osecond)}"


def oname_sig_switch(obase, oleft, oright):
    return f"il.sig.switch.{oget_track(obase)}-{oget_track(oleft)}-{oget_track(oright)}"


def oname_sig_bal3(ofirst, osecond):
    return f"il.sig.bal3.{oget_track(ofirst)}_{oget_side(ofirst)}-{oget_track(osecond)}_{oget_side(osecond)}"


class Infra:
    def oget_signal_position(self, ofirst, osecond):
        length = self.lengths[oget_track(ofirst)]
        if oget_direction(ofirst, osecond) == "NORMAL" and oget_side(ofirst) == "BEGIN":
            return self.SPACE_TDE - self.SPACE_SIG
        elif oget_direction(ofirst, osecond) == "NORMAL" and oget_side(ofirst) == "END":
            return length - self.SPACE_TDE - self.SPACE_SIG
        elif (
            oget_direction(ofirst, osecond) == "REVERSE"
            and oget_side(ofirst) == "BEGIN"
        ):
            return self.SPACE_TDE + self.SPACE_SIG
        else:
            return length - self.SPACE_TDE + self.SPACE_SIG

    def build_aspects(self, cbtc):
        if cbtc:
            self.build_aspects_cbtc()
        else:
            self.build_aspects_bal3()

    def build_aspects_bal3(self):
        self.json["aspects"] = [
            {"id": "GREEN", "color": "#2a850c", "constraints": []},
            {
                "id": "YELLOW",
                "color": "#f08a05",
                "constraints": [
                    {
                        "type": "speed_limit",
                        "speed": 8.33333333333333,
                        "applies_at": {"element": "NEXT_SIGNAL", "offset": -100},
                        "until": {"element": "NEXT_SIGNAL", "offset": 0},
                    }
                ],
            },
            {
                "id": "RED",
                "color": "#db0c04",
                "constraints": [
                    {
                        "type": "speed_limit",
                        "speed": 0,
                        "applies_at": {"element": "CURRENT_SIGNAL", "offset": -5},
                        "until": {"element": "END", "offset": 0},
                    }
                ],
            },
        ]

    def build_aspects_cbtc(self):
        self.json["aspects"] = [
            {"id": "WHITE_CROSS", "color": "#ffffff", "constraints": []},
            {"id": "GREEN", "color": "#2a850c", "constraints": []},
            {
                "id": "YELLOW",
                "color": "#f08a05",
                "constraints": [
                    {
                        "type": "speed_limit",
                        "speed": 8.33333333333333,
                        "applies_at": {"element": "NEXT_SIGNAL", "offset": -100},
                        "until": {"element": "NEXT_SIGNAL", "offset": 0},
                    }
                ],
            },
            {
                "id": "RED",
                "color": "#db0c04",
                "constraints": [
                    {
                        "type": "speed_limit",
                        "speed": 0,
                        "applies_at": {"element": "CURRENT_SIGNAL", "offset": -5},
                        "until": {"element": "END", "offset": 0},
                    }
                ],
            },
        ]

    def build_script_functions(self, cbtc=False):
        if cbtc:
            self.build_script_functions_cbtc()
        else:
            self.build_script_functions_bal3()

    def build_script_functions_bal3(self):
        self.json["script_functions"] = [
            {
                "name": "sncf_filter",
                "arguments": [{"type": "ASPECT_SET", "name": "aspects"}],
                "return_type": "ASPECT_SET",
                "body": {
                    "type": "condition",
                    "if": {
                        "type": "aspect_set_contains",
                        "aspect_set": {
                            "type": "argument_ref",
                            "argument_name": "aspects",
                        },
                        "aspect": "RED",
                    },
                    "then": {"type": "aspect_set", "members": [{"aspect": "RED"}]},
                    "else": {
                        "type": "condition",
                        "if": {
                            "type": "aspect_set_contains",
                            "aspect_set": {
                                "type": "argument_ref",
                                "argument_name": "aspects",
                            },
                            "aspect": "YELLOW",
                        },
                        "then": {
                            "type": "aspect_set",
                            "members": [{"aspect": "YELLOW"}],
                        },
                        "else": {"type": "argument_ref", "argument_name": "aspects"},
                    },
                },
            },
            {
                "name": "warn_signal",
                "arguments": [{"type": "SIGNAL", "name": "master_signal"}],
                "return_type": "ASPECT_SET",
                "body": {
                    "type": "call",
                    "function": "sncf_filter",
                    "arguments": [
                        {
                            "type": "aspect_set",
                            "members": [
                                {
                                    "aspect": "YELLOW",
                                    "condition": {
                                        "type": "signal_has_aspect",
                                        "signal": {
                                            "type": "argument_ref",
                                            "argument_name": "master_signal",
                                        },
                                        "aspect": "RED",
                                    },
                                },
                                {"aspect": "GREEN"},
                            ],
                        }
                    ],
                },
            },
            {
                "name": "check_route",
                "arguments": [{"type": "ROUTE", "name": "route"}],
                "return_type": "ASPECT_SET",
                "body": {
                    "type": "condition",
                    "if": {
                        "type": "or",
                        "exprs": [
                            {
                                "type": "route_has_state",
                                "route": {
                                    "type": "argument_ref",
                                    "argument_name": "route",
                                },
                                "state": "OCCUPIED",
                            },
                            {
                                "type": "route_has_state",
                                "route": {
                                    "type": "argument_ref",
                                    "argument_name": "route",
                                },
                                "state": "REQUESTED",
                            },
                            {
                                "type": "route_has_state",
                                "route": {
                                    "type": "argument_ref",
                                    "argument_name": "route",
                                },
                                "state": "CONFLICT",
                            },
                        ],
                    },
                    "then": {"type": "aspect_set", "members": [{"aspect": "RED"}]},
                    "else": {"type": "aspect_set", "members": [{"aspect": "YELLOW"}]},
                },
            },
            {
                "name": "bal3_line_signal",
                "arguments": [
                    {"type": "SIGNAL", "name": "master_signal"},
                    {"type": "ROUTE", "name": "route"},
                ],
                "return_type": "ASPECT_SET",
                "body": {
                    "type": "call",
                    "function": "sncf_filter",
                    "arguments": [
                        {
                            "type": "aspect_set",
                            "members": [
                                {
                                    "aspect": "RED",
                                    "condition": {
                                        "type": "not",
                                        "expr": {
                                            "type": "route_has_state",
                                            "route": {
                                                "type": "argument_ref",
                                                "argument_name": "route",
                                            },
                                            "state": "RESERVED",
                                        },
                                    },
                                },
                                {
                                    "aspect": "YELLOW",
                                    "condition": {
                                        "type": "signal_has_aspect",
                                        "signal": {
                                            "type": "argument_ref",
                                            "argument_name": "master_signal",
                                        },
                                        "aspect": "RED",
                                    },
                                },
                                {"aspect": "GREEN"},
                            ],
                        }
                    ],
                },
            },
            {
                "name": "switch_signal",
                "arguments": [
                    {"type": "SWITCH", "name": "switch"},
                    {"type": "ROUTE", "name": "left_route"},
                    {"type": "SIGNAL", "name": "left_master_signal"},
                    {"type": "ROUTE", "name": "right_route"},
                    {"type": "SIGNAL", "name": "right_master_signal"},
                ],
                "return_type": "ASPECT_SET",
                "body": {
                    "type": "match",
                    "expr": {"type": "argument_ref", "argument_name": "switch"},
                    "branches": {
                        "LEFT": {
                            "type": "call",
                            "function": "sncf_filter",
                            "arguments": [
                                {
                                    "type": "aspect_set",
                                    "members": [
                                        {
                                            "aspect": "RED",
                                            "condition": {
                                                "type": "not",
                                                "expr": {
                                                    "type": "route_has_state",
                                                    "route": {
                                                        "type": "argument_ref",
                                                        "argument_name": "left_route",
                                                    },
                                                    "state": "RESERVED",
                                                },
                                            },
                                        },
                                        {
                                            "aspect": "YELLOW",
                                            "condition": {
                                                "type": "signal_has_aspect",
                                                "signal": {
                                                    "type": "argument_ref",
                                                    "argument_name": "left_master_signal",
                                                },
                                                "aspect": "RED",
                                            },
                                        },
                                        {"aspect": "GREEN"},
                                    ],
                                }
                            ],
                        },
                        "RIGHT": {
                            "type": "call",
                            "function": "sncf_filter",
                            "arguments": [
                                {
                                    "type": "aspect_set",
                                    "members": [
                                        {
                                            "aspect": "RED",
                                            "condition": {
                                                "type": "not",
                                                "expr": {
                                                    "type": "route_has_state",
                                                    "route": {
                                                        "type": "argument_ref",
                                                        "argument_name": "right_route",
                                                    },
                                                    "state": "RESERVED",
                                                },
                                            },
                                        },
                                        {
                                            "aspect": "YELLOW",
                                            "condition": {
                                                "type": "signal_has_aspect",
                                                "signal": {
                                                    "type": "argument_ref",
                                                    "argument_name": "right_master_signal",
                                                },
                                                "aspect": "RED",
                                            },
                                        },
                                        {"aspect": "GREEN"},
                                    ],
                                }
                            ],
                        },
                        "MOVING": {
                            "type": "aspect_set",
                            "members": [{"aspect": "RED"}],
                        },
                    },
                },
            },
        ]

    def build_script_functions_cbtc(self):
        self.json["script_functions"] = [
            {
                "name": "sncf_filter",
                "arguments": [{"type": "ASPECT_SET", "name": "aspects"}],
                "return_type": "ASPECT_SET",
                "body": {
                    "type": "condition",
                    "if": {
                        "type": "aspect_set_contains",
                        "aspect_set": {
                            "type": "argument_ref",
                            "argument_name": "aspects",
                        },
                        "aspect": "WHITE_CROSS",
                    },
                    "then": {
                        "type": "aspect_set",
                        "members": [{"aspect": "WHITE_CROSS"}],
                    },
                    "else": {
                        "type": "condition",
                        "if": {
                            "type": "aspect_set_contains",
                            "aspect_set": {
                                "type": "argument_ref",
                                "argument_name": "aspects",
                            },
                            "aspect": "RED",
                        },
                        "then": {"type": "aspect_set", "members": [{"aspect": "RED"}]},
                        "else": {
                            "type": "condition",
                            "if": {
                                "type": "aspect_set_contains",
                                "aspect_set": {
                                    "type": "argument_ref",
                                    "argument_name": "aspects",
                                },
                                "aspect": "YELLOW",
                            },
                            "then": {
                                "type": "aspect_set",
                                "members": [{"aspect": "YELLOW"}],
                            },
                            "else": {
                                "type": "argument_ref",
                                "argument_name": "aspects",
                            },
                        },
                    },
                },
            },
            {
                "name": "warn_signal",
                "arguments": [{"type": "SIGNAL", "name": "master_signal"}],
                "return_type": "ASPECT_SET",
                "body": {
                    "type": "call",
                    "function": "sncf_filter",
                    "arguments": [
                        {
                            "type": "aspect_set",
                            "members": [
                                {
                                    "aspect": "WHITE_CROSS",
                                    "condition": {
                                        "type": "signal_has_aspect",
                                        "signal": {
                                            "type": "argument_ref",
                                            "argument_name": "master_signal",
                                        },
                                        "aspect": "WHITE_CROSS",
                                    },
                                },
                                {
                                    "aspect": "YELLOW",
                                    "condition": {
                                        "type": "signal_has_aspect",
                                        "signal": {
                                            "type": "argument_ref",
                                            "argument_name": "master_signal",
                                        },
                                        "aspect": "RED",
                                    },
                                },
                                {"aspect": "GREEN"},
                            ],
                        }
                    ],
                },
            },
            {
                "name": "check_route",
                "arguments": [{"type": "ROUTE", "name": "route"}],
                "return_type": "ASPECT_SET",
                "body": {
                    "type": "condition",
                    "if": {
                        "type": "or",
                        "exprs": [
                            {
                                "type": "route_has_state",
                                "route": {
                                    "type": "argument_ref",
                                    "argument_name": "route",
                                },
                                "state": "OCCUPIED",
                            },
                            {
                                "type": "route_has_state",
                                "route": {
                                    "type": "argument_ref",
                                    "argument_name": "route",
                                },
                                "state": "REQUESTED",
                            },
                            {
                                "type": "route_has_state",
                                "route": {
                                    "type": "argument_ref",
                                    "argument_name": "route",
                                },
                                "state": "CBTC_OCCUPIED",
                            },
                            {
                                "type": "route_has_state",
                                "route": {
                                    "type": "argument_ref",
                                    "argument_name": "route",
                                },
                                "state": "CBTC_REQUESTED",
                            },
                            {
                                "type": "route_has_state",
                                "route": {
                                    "type": "argument_ref",
                                    "argument_name": "route",
                                },
                                "state": "CONFLICT",
                            },
                        ],
                    },
                    "then": {"type": "aspect_set", "members": [{"aspect": "RED"}]},
                    "else": {"type": "aspect_set", "members": [{"aspect": "YELLOW"}]},
                },
            },
            {
                "name": "switch_signal",
                "arguments": [
                    {"type": "SWITCH", "name": "switch"},
                    {"type": "ROUTE", "name": "left_route"},
                    {"type": "SIGNAL", "name": "left_master_signal"},
                    {"type": "ROUTE", "name": "right_route"},
                    {"type": "SIGNAL", "name": "right_master_signal"},
                ],
                "return_type": "ASPECT_SET",
                "body": {
                    "type": "match",
                    "expr": {"type": "argument_ref", "argument_name": "switch"},
                    "branches": {
                        "LEFT": {
                            "type": "call",
                            "function": "sncf_filter",
                            "arguments": [
                                {
                                    "type": "aspect_set",
                                    "members": [
                                        {
                                            "aspect": "RED",
                                            "condition": {
                                                "type": "not",
                                                "expr": {
                                                    "type": "or",
                                                    "exprs": [
                                                        {
                                                            "type": "route_has_state",
                                                            "route": {
                                                                "type": "argument_ref",
                                                                "argument_name": "left_route",
                                                            },
                                                            "state": "RESERVED"
                                                        },
                                                        {
                                                            "type": "route_has_state",
                                                            "route": {
                                                                "type": "argument_ref",
                                                                "argument_name": "left_route",
                                                            },
                                                            "state": "CBTC_RESERVED"
                                                        },
                                                    ]
                                                },
                                            },
                                        },
                                        {
                                            "aspect": "YELLOW",
                                            "condition": {
                                                "type": "signal_has_aspect",
                                                "signal": {
                                                    "type": "argument_ref",
                                                    "argument_name": "left_master_signal",
                                                },
                                                "aspect": "RED",
                                            },
                                        },
                                        {"aspect": "GREEN"},
                                    ],
                                }
                            ],
                        },
                        "RIGHT": {
                            "type": "call",
                            "function": "sncf_filter",
                            "arguments": [
                                {
                                    "type": "aspect_set",
                                    "members": [
                                        {
                                            "aspect": "RED",
                                            "condition": {
                                                "type": "not",
                                                "expr": {
                                                    "type": "or",
                                                    "exprs": [
                                                        {
                                                            "type": "route_has_state",
                                                            "route": {
                                                                "type": "argument_ref",
                                                                "argument_name": "right_route",
                                                            },
                                                            "state": "RESERVED"
                                                        },
                                                        {
                                                            "type": "route_has_state",
                                                            "route": {
                                                                "type": "argument_ref",
                                                                "argument_name": "right_route",
                                                            },
                                                            "state": "CBTC_RESERVED"
                                                        },
                                                    ]
                                                },
                                            },
                                        },
                                        {
                                            "aspect": "YELLOW",
                                            "condition": {
                                                "type": "signal_has_aspect",
                                                "signal": {
                                                    "type": "argument_ref",
                                                    "argument_name": "right_master_signal",
                                                },
                                                "aspect": "RED",
                                            },
                                        },
                                        {"aspect": "GREEN"},
                                    ],
                                }
                            ],
                        },
                        "MOVING": {
                            "type": "aspect_set",
                            "members": [{"aspect": "RED"}],
                        },
                    },
                },
            },
            {
                "name": "cbtc_switch_signal",
                "arguments": [
                    {"type": "SIGNAL", "name": "switch_signal"},
                    {"type": "SWITCH", "name": "switch"},
                    {"type": "ROUTE", "name": "left_route"},
                    {"type": "SIGNAL", "name": "left_master_signal"},
                    {"type": "ROUTE", "name": "right_route"},
                    {"type": "SIGNAL", "name": "right_master_signal"},
                ],
                "return_type": "ASPECT_SET",
                "body": {
                    "type": "optional_match",
                    "name": "previous_route",
                    "expr": {
                        "type": "previous_reserved_route",
                        "signal": {
                            "type": "argument_ref",
                            "argument_name": "switch_signal",
                        },
                    },
                    "case_some": {
                        "type": "condition",
                        "if": {
                            "type": "or",
                            "exprs": [
                                {
                                    "type": "route_has_state",
                                    "route": {
                                        "type": "optional_match_ref",
                                        "match_name": "previous_route",
                                    },
                                    "state": "CBTC_OCCUPIED",
                                },
                                {
                                    "type": "route_has_state",
                                    "route": {
                                        "type": "optional_match_ref",
                                        "match_name": "previous_route",
                                    },
                                    "state": "CBTC_RESERVED",
                                },
                            ],
                        },
                        "then": {
                            "type": "aspect_set",
                            "members": [{"aspect": "WHITE_CROSS"}],
                        },
                        "else": {
                            "type": "call",
                            "function": "switch_signal",
                            "arguments": [
                                {
                                    "type": "argument_ref",
                                    "argument_name": "switch",
                                },
                                {
                                    "type": "argument_ref",
                                    "argument_name": "left_route",
                                },
                                {
                                    "type": "argument_ref",
                                    "argument_name": "left_master_signal",
                                },
                                {
                                    "type": "argument_ref",
                                    "argument_name": "right_route",
                                },
                                {
                                    "type": "argument_ref",
                                    "argument_name": "right_master_signal",
                                },
                            ],
                        },
                    },
                    "case_none": {
                        "type": "call",
                        "function": "switch_signal",
                        "arguments": [
                            {
                                "type": "argument_ref",
                                "argument_name": "switch",
                            },
                            {
                                "type": "argument_ref",
                                "argument_name": "left_route",
                            },
                            {
                                "type": "argument_ref",
                                "argument_name": "left_master_signal",
                            },
                            {
                                "type": "argument_ref",
                                "argument_name": "right_route",
                            },
                            {
                                "type": "argument_ref",
                                "argument_name": "right_master_signal",
                            },
                        ],
                    },
                },
            },
            {
                "name": "bal3_line_signal",
                "arguments": [{"type": "SIGNAL", "name": "master_signal"}],
                "return_type": "ASPECT_SET",
                "body": {
                    "type": "optional_match",
                    "name": "route",
                    "expr": {
                        "type": "reserved_route",
                        "signal": {
                            "type": "argument_ref",
                            "argument_name": "master_signal",
                        },
                    },
                    "case_none": {"type": "aspect_set", "members": [{"aspect": "RED"}]},
                    "case_some": {
                        "type": "optional_match",
                        "name": "signal",
                        "expr": {
                            "type": "next_signal",
                            "route": {
                                "type": "optional_match_ref",
                                "match_name": "route",
                            },
                            "signal": {
                                "type": "argument_ref",
                                "argument_name": "master_signal",
                            },
                        },
                        "case_none": {
                            "type": "aspect_set",
                            "members": [{"aspect": "YELLOW"}],
                        },
                        "case_some": {
                            "type": "condition",
                            "if": {
                                "type": "or",
                                "exprs": [
                                    {
                                        "type": "signal_has_aspect",
                                        "signal": {
                                            "type": "optional_match_ref",
                                            "match_name": "signal",
                                        },
                                        "aspect": "RED",
                                    },
                                    {
                                        "type": "signal_has_aspect",
                                        "signal": {
                                            "type": "optional_match_ref",
                                            "match_name": "signal",
                                        },
                                        "aspect": "WHITE_CROSS",
                                    },
                                ],
                            },
                            "then": {
                                "type": "aspect_set",
                                "members": [{"aspect": "YELLOW"}],
                            },
                            "else": {
                                "type": "aspect_set",
                                "members": [{"aspect": "GREEN"}],
                            },
                        },
                    },
                },
            },
            {
                "name": "cbtc_line_signal",
                "arguments": [{"type": "SIGNAL", "name": "master_signal"}],
                "return_type": "ASPECT_SET",
                "body": {
                    "type": "optional_match",
                    "name": "previous_route",
                    "expr": {
                        "type": "previous_reserved_route",
                        "signal": {
                            "type": "argument_ref",
                            "argument_name": "master_signal",
                        },
                    },
                    "case_some": {
                        "type": "condition",
                        "if": {
                            "type": "or",
                            "exprs": [
                                {
                                    "type": "route_has_state",
                                    "route": {
                                        "type": "optional_match_ref",
                                        "match_name": "previous_route",
                                    },
                                    "state": "CBTC_OCCUPIED",
                                },
                                {
                                    "type": "route_has_state",
                                    "route": {
                                        "type": "optional_match_ref",
                                        "match_name": "previous_route",
                                    },
                                    "state": "CBTC_RESERVED",
                                },
                            ],
                        },
                        "then": {
                            "type": "aspect_set",
                            "members": [{"aspect": "WHITE_CROSS"}],
                        },
                        "else": {
                            "type": "call",
                            "function": "bal3_line_signal",
                            "arguments": [
                                {
                                    "type": "argument_ref",
                                    "argument_name": "master_signal",
                                }
                            ],
                        },
                    },
                    "case_none": {
                        "type": "call",
                        "function": "bal3_line_signal",
                        "arguments": [
                            {"type": "argument_ref", "argument_name": "master_signal"}
                        ],
                    },
                },
            },
        ]

    def build_speed_sections(self):
        self.json["speed_sections"] = []

    def build_operational_points(self):
        self.json["operational_points"] = []

    def build_track_sections(self, cbtc=False):
        self.json["track_sections"] = []
        for utrack in range(self.nb_tracks):
            self.json["track_sections"].append(
                {
                    "id": uname_track(utrack),
                    "length": self.lengths[utrack],
                    "operational_points": [],
                    "route_waypoints": None,
                    "signals": [],
                    "slopes": [],
                    "curves": [],
                    "speed_sections": [],
                    "endpoints_coords": [
                        self.coordinates[uget_begin(utrack)],
                        self.coordinates[uget_end(utrack)],
                    ],
                }
            )
        self.build_tde()
        self.build_signals(cbtc=cbtc)

    def build_tde(self):
        for utrack in range(self.nb_tracks):
            if self.degree[utrack] == 1:
                self.json["track_sections"][utrack]["route_waypoints"] = [
                    {
                        "type": "detector",
                        "applicable_direction": "BOTH",
                        "id": uname_tde_begin(utrack),
                        "position": self.SPACE_TDE,
                    },
                    {
                        "type": "buffer_stop",
                        "applicable_direction": "NORMAL",
                        "id": uname_buffer_stop(utrack),
                        "position": self.lengths[utrack],
                    },
                ]
            else:
                self.json["track_sections"][utrack]["route_waypoints"] = [
                    {
                        "type": "detector",
                        "applicable_direction": "BOTH",
                        "id": uname_tde_begin(utrack),
                        "position": self.SPACE_TDE,
                    },
                    {
                        "type": "detector",
                        "applicable_direction": "BOTH",
                        "id": uname_tde_end(utrack),
                        "position": self.lengths[utrack] - self.SPACE_TDE,
                    },
                ]

    def build_tvd_sections(self):
        self.json["tvd_sections"] = []
        for utrack in range(self.nb_tracks):
            self.json["tvd_sections"].append(
                {
                    "id": uname_tvd_track(utrack),
                    "is_berthing_track": True,
                    "buffer_stops": [],
                    "train_detectors": [uname_tde_begin(utrack)],
                }
            )
            if self.degree[utrack] == 1:
                self.json["tvd_sections"][-1]["buffer_stops"].append(
                    uname_buffer_stop(utrack)
                )
            else:
                self.json["tvd_sections"][-1]["train_detectors"].append(
                    uname_tde_end(utrack)
                )
        for ofirst, osecond in self.links:
            self.json["tvd_sections"].append(
                {
                    "id": oname_tvd_link(ofirst, osecond),
                    "is_berthing_track": True,
                    "buffer_stops": [],
                    "train_detectors": [oname_tde(ofirst), oname_tde(osecond)],
                }
            )
        for obase, oleft, oright in self.switches:
            self.json["tvd_sections"].append(
                {
                    "id": oname_tvd_switch(obase, oleft, oright),
                    "is_berthing_track": True,
                    "buffer_stops": [],
                    "train_detectors": [
                        oname_tde(obase),
                        oname_tde(oleft),
                        oname_tde(oright),
                    ],
                }
            )

    def build_routes(self):
        self.json["routes"] = []
        # routes associated with tracks
        for utrack in range(self.nb_tracks):
            self.json["routes"].append(
                {
                    "id": oname_route_between(uget_begin(utrack), uget_end(utrack)),
                    "entry_point": uname_tde_begin(utrack),
                    "exit_point": uname_tde_end(utrack)
                    if self.degree[utrack] == 2
                    else uname_buffer_stop(utrack),
                    "entry_direction": "START_TO_STOP",
                    "switches_position": {},
                    "release_groups": [[uname_tvd_track(utrack)]],
                }
            )
            self.json["routes"].append(
                {
                    "id": oname_route_between(uget_end(utrack), uget_begin(utrack)),
                    "entry_point": uname_tde_end(utrack)
                    if self.degree[utrack] == 2
                    else uname_buffer_stop(utrack),
                    "exit_point": uname_tde_begin(utrack),
                    "entry_direction": "STOP_TO_START",
                    "switches_position": {},
                    "release_groups": [[uname_tvd_track(utrack)]],
                }
            )
        # routes associated with links
        for ofirst, osecond in self.links:
            self.json["routes"].append(
                {
                    "id": oname_route_between(ofirst, osecond),
                    "entry_point": oname_tde(ofirst),
                    "exit_point": oname_tde(osecond),
                    "entry_direction": "STOP_TO_START" if ofirst % 2 == 0 else "START_TO_STOP",
                    "switches_position": {},
                    "release_groups": [[oname_tvd_link(ofirst, osecond)]],
                }
            )
            self.json["routes"].append(
                {
                    "id": oname_route_between(osecond, ofirst),
                    "entry_point": oname_tde(osecond),
                    "exit_point": oname_tde(ofirst),
                    "entry_direction": "STOP_TO_START" if osecond % 2 == 0 else "START_TO_STOP",
                    "switches_position": {},
                    "release_groups": [[oname_tvd_link(ofirst, osecond)]],
                }
            )
        # routes associated with switches
        for obase, oleft, oright in self.switches:
            self.json["routes"].append(
                {
                    "id": oname_route_between(obase, oleft),
                    "entry_point": oname_tde(obase),
                    "exit_point": oname_tde(oleft),
                    "entry_direction": "STOP_TO_START" if obase % 2 == 0 else "START_TO_STOP",
                    "switches_position": {oname_switch(obase, oleft, oright): "LEFT"},
                    "release_groups": [[oname_tvd_switch(obase, oleft, oright)]],
                }
            )
            self.json["routes"].append(
                {
                    "id": oname_route_between(obase, oright),
                    "entry_point": oname_tde(obase),
                    "exit_point": oname_tde(oright),
                    "entry_direction": "STOP_TO_START" if obase % 2 == 0 else "START_TO_STOP",
                    "switches_position": {oname_switch(obase, oleft, oright): "RIGHT"},
                    "release_groups": [[oname_tvd_switch(obase, oleft, oright)]],
                }
            )
            self.json["routes"].append(
                {
                    "id": oname_route_between(oleft, obase),
                    "entry_point": oname_tde(oleft),
                    "exit_point": oname_tde(obase),
                    "entry_direction": "STOP_TO_START" if oleft % 2 == 0 else "START_TO_STOP",
                    "switches_position": {oname_switch(obase, oleft, oright): "LEFT"},
                    "release_groups": [[oname_tvd_switch(obase, oleft, oright)]],
                }
            )
            self.json["routes"].append(
                {
                    "id": oname_route_between(oright, obase),
                    "entry_point": oname_tde(oright),
                    "exit_point": oname_tde(obase),
                    "entry_direction": "STOP_TO_START" if oright % 2 == 0 else "START_TO_STOP",
                    "switches_position": {oname_switch(obase, oleft, oright): "RIGHT"},
                    "release_groups": [[oname_tvd_switch(obase, oleft, oright)]],
                }
            )

    def build_signal_bal3(self, ofirst, osecond):
        ufirst = oget_track(ofirst)
        usecond = oget_track(osecond)
        if (
            ufirst == usecond
            and self.degree[ufirst] == 1
            and oget_side(osecond) == "END"
        ):
            self.json["track_sections"][ufirst]["signals"].append(
                {
                    "expr": {
                        "type": "call",
                        "function": "check_route",
                        "arguments": [
                            {
                                "type": "route",
                                "route": oname_route_between(ofirst, osecond),
                            }
                        ],
                    },
                    "id": oname_sig_bal3(ofirst, osecond),
                    "linked_detector": oname_tde(ofirst),
                    "applicable_direction": oget_direction(ofirst, osecond),
                    "position": self.oget_signal_position(ofirst, osecond),
                    "sight_distance": self.SIGHT_DISTANCE,
                }
            )
        else:
            next_signal = None
            if ufirst != usecond:
                next_signal = oname_sig_bal3(osecond, oget_other_side(osecond))
            else:
                for othird, ofourth in self.links:
                    if othird == osecond:
                        next_signal = oname_sig_bal3(othird, ofourth)
                    if ofourth == osecond:
                        next_signal = oname_sig_bal3(ofourth, othird)
                for obase, oleft, oright in self.switches:
                    if obase == osecond:
                        next_signal = oname_sig_switch(obase, oleft, oright)
                    if oleft == osecond:
                        next_signal = oname_sig_bal3(oleft, obase)
                    if oright == osecond:
                        next_signal = oname_sig_bal3(oright, obase)
            self.json["track_sections"][ufirst]["signals"].append(
                {
                    "expr": {
                        "type": "call",
                        "function": "bal3_line_signal",
                        "arguments": [
                            {"type": "signal", "signal": next_signal},
                            {
                                "type": "route",
                                "route": oname_route_between(ofirst, osecond),
                            },
                        ],
                    },
                    "id": oname_sig_bal3(ofirst, osecond),
                    "linked_detector": oname_tde(ofirst),
                    "applicable_direction": oget_direction(ofirst, osecond),
                    "position": self.oget_signal_position(ofirst, osecond),
                    "sight_distance": self.SIGHT_DISTANCE,
                }
            )

    def build_signal_cbtc(self, ofirst, osecond):
        ufirst = oget_track(ofirst)
        usecond = oget_track(osecond)
        if (
            ufirst == usecond
            and self.degree[ufirst] == 1
            and oget_side(osecond) == "END"
        ):
            self.json["track_sections"][ufirst]["signals"].append(
                {
                    "expr": {
                        "type": "call",
                        "function": "check_route",
                        "arguments": [
                            {
                                "type": "route",
                                "route": oname_route_between(ofirst, osecond),
                            }
                        ],
                    },
                    "id": oname_sig_bal3(ofirst, osecond),
                    "linked_detector": oname_tde(ofirst),
                    "applicable_direction": oget_direction(ofirst, osecond),
                    "position": self.oget_signal_position(ofirst, osecond),
                    "sight_distance": self.SIGHT_DISTANCE,
                }
            )
        else:
            self.json["track_sections"][ufirst]["signals"].append(
                {
                    "expr": {
                        "type": "call",
                        "function": "cbtc_line_signal",
                        "arguments": [
                            {
                                "type": "signal",
                                "signal": oname_sig_bal3(ofirst, osecond),
                            }
                        ],
                    },
                    "id": oname_sig_bal3(ofirst, osecond),
                    "linked_detector": oname_tde(ofirst),
                    "applicable_direction": oget_direction(ofirst, osecond),
                    "position": self.oget_signal_position(ofirst, osecond),
                    "sight_distance": self.SIGHT_DISTANCE,
                }
            )

    def build_line_signal(self, ofirst, osecond, cbtc=False):
        if cbtc:
            self.build_signal_cbtc(ofirst, osecond)
        else:
            self.build_signal_bal3(ofirst, osecond)

    def build_switch_signal(self, obase, oleft, oright, cbtc=False):
        left_next_signal = oname_sig_bal3(oleft, oget_other_side(oleft))
        right_next_signal = oname_sig_bal3(oright, oget_other_side(oright))
        if cbtc:
            self.json["track_sections"][oget_track(obase)]["signals"].append(
                {
                    "expr": {
                        "type": "call",
                        "function": "cbtc_switch_signal",
                        "arguments": [
                            {"type": "signal", "signal": oname_sig_switch(obase, oleft, oright)},
                            {
                                "type": "switch",
                                "switch": oname_switch(obase, oleft, oright),
                            },
                            {
                                "type": "route",
                                "route": oname_route_between(obase, oleft),
                            },
                            {"type": "signal", "signal": left_next_signal},
                            {
                                "type": "route",
                                "route": oname_route_between(obase, oright),
                            },
                            {"type": "signal", "signal": right_next_signal},
                        ],
                    },
                    "id": oname_sig_switch(obase, oleft, oright),
                    "linked_detector": oname_tde(obase),
                    "applicable_direction": oget_direction(obase, oleft),
                    "position": self.oget_signal_position(obase, oleft),
                    "sight_distance": self.SIGHT_DISTANCE,
                }
            )
        else:
            self.json["track_sections"][oget_track(obase)]["signals"].append(
                {
                    "expr": {
                        "type": "call",
                        "function": "switch_signal",
                        "arguments": [
                            {
                                "type": "switch",
                                "switch": oname_switch(obase, oleft, oright),
                            },
                            {
                                "type": "route",
                                "route": oname_route_between(obase, oleft),
                            },
                            {"type": "signal", "signal": left_next_signal},
                            {
                                "type": "route",
                                "route": oname_route_between(obase, oright),
                            },
                            {"type": "signal", "signal": right_next_signal},
                        ],
                    },
                    "id": oname_sig_switch(obase, oleft, oright),
                    "linked_detector": oname_tde(obase),
                    "applicable_direction": oget_direction(obase, oleft),
                    "position": self.oget_signal_position(obase, oleft),
                    "sight_distance": self.SIGHT_DISTANCE,
                }
            )
        self.build_line_signal(oleft, obase, cbtc=cbtc)
        self.build_line_signal(oright, obase, cbtc=cbtc)

    def build_signals(self, cbtc=False):
        for utrack in range(self.nb_tracks):
            self.build_line_signal(uget_begin(utrack), uget_end(utrack), cbtc=cbtc)
            if self.degree[utrack] == 2:
                self.build_line_signal(uget_end(utrack), uget_begin(utrack), cbtc=cbtc)
        for ofirst, osecond in self.links:
            self.build_line_signal(ofirst, osecond, cbtc=cbtc)
            self.build_line_signal(osecond, ofirst, cbtc=cbtc)
        for obase, oleft, oright in self.switches:
            self.build_switch_signal(obase, oleft, oright, cbtc=cbtc)

    def build_switches(self):
        self.json["switches"] = []
        for obase, oleft, oright in self.switches:
            self.json["switches"].append(
                {
                    "base": {
                        "endpoint": oget_side(obase),
                        "section": oname_track(obase),
                    },
                    "left": {
                        "endpoint": oget_side(oleft),
                        "section": oname_track(oleft),
                    },
                    "right": {
                        "endpoint": oget_side(oright),
                        "section": oname_track(oright),
                    },
                    "id": oname_switch(obase, oleft, oright),
                    "position_change_delay": self.POSITION_CHANGE_DELAY,
                }
            )

    def build_track_section_links(self):
        self.json["track_section_links"] = []
        for ofirst, osecond in self.links:
            self.json["track_section_links"].append(
                {
                    "begin": {
                        "endpoint": oget_side(ofirst),
                        "section": oname_track(ofirst),
                    },
                    "end": {
                        "endpoint": oget_side(osecond),
                        "section": oname_track(osecond),
                    },
                    "navigability": "BOTH",
                }
            )
        for obase, oleft, oright in self.switches:
            self.json["track_section_links"].append(
                {
                    "begin": {
                        "endpoint": oget_side(obase),
                        "section": oname_track(obase),
                    },
                    "end": {
                        "endpoint": oget_side(oleft),
                        "section": oname_track(oleft),
                    },
                    "navigability": "BOTH",
                }
            )
            self.json["track_section_links"].append(
                {
                    "begin": {
                        "endpoint": oget_side(obase),
                        "section": oname_track(obase),
                    },
                    "end": {
                        "endpoint": oget_side(oright),
                        "section": oname_track(oright),
                    },
                    "navigability": "BOTH",
                }
            )

    def new_point(self, utrack):
        assert 0 <= self.degree[utrack] <= 1
        self.degree[utrack] += 1
        if self.degree[utrack] == 1:
            return uget_begin(utrack)
        else:
            return uget_end(utrack)

    def add_link(self, ufirst, usecond, x=0, y=0):
        ofirst = self.new_point(ufirst)
        osecond = self.new_point(usecond)
        self.links.append((ofirst, osecond))
        self.coordinates[ofirst] = (x, y)
        self.coordinates[osecond] = (x, y)

    def add_switch(self, ubase, uleft, uright, x=0, y=0):
        obase = self.new_point(ubase)
        oleft = self.new_point(uleft)
        oright = self.new_point(uright)
        self.switches.append((obase, oleft, oright))
        self.coordinates[obase] = (x, y)
        self.coordinates[oleft] = (x, y)
        self.coordinates[oright] = (x, y)

    def set_buffer_stop_coordinates(self, utrack, x, y):
        assert self.degree[utrack] == 1
        self.coordinates[uget_end(utrack)] = (x, y)

    def to_json(self, cbtc=False):
        for utrack in range(self.nb_tracks):
            assert self.degree[utrack] in [1, 2]

        self.build_aspects(cbtc=cbtc)
        self.build_operational_points()
        self.build_routes()
        self.build_script_functions(cbtc=cbtc)
        self.build_speed_sections()
        self.build_switches()
        self.build_track_section_links()
        self.build_track_sections(cbtc=cbtc)
        self.build_tvd_sections()
        self.json["version"] = "1"
        return self.json

    def __init__(self, lengths, space_tde=200, space_sig=25, sight_distance=400):
        self.POSITION_CHANGE_DELAY = 6
        self.SPACE_TDE = space_tde
        self.SPACE_SIG = space_sig
        self.SIGHT_DISTANCE = sight_distance

        self.json = dict()
        self.nb_tracks = len(lengths)
        self.lengths = lengths
        self.degree = [0 for utrack in range(self.nb_tracks)]
        self.links = []
        self.switches = []
        self.coordinates = [(0, 0) for otrack in range(2 * self.nb_tracks)]


class Simulation:
    def build_rolling_stocks(self):
        self.json["rolling_stocks"] = [
            {
                "id": "fast_rolling_stock",
                "rolling_resistance": {
                    "type": "davis",
                    "A": 5400.0,
                    "B": 200.0,
                    "C": 12.0,
                },
                "length": 400,
                "max_speed": 80,
                "startup_time": 10,
                "startup_acceleration": 0.05,
                "comfort_acceleration": 0.25,
                "gamma": 0.5,
                "gamma_type": "CONST",
                "mass": 900000,
                "inertia_coefficient": 1.05,
                "features": ["TVM300", "TVM430", "ETCS1", "ETCS2", "KVB"],
                "tractive_effort_curve": [
                    {"speed": 0, "max_effort": 441666.6666666667},
                    {"speed": 5, "max_effort": 439473.6842105263},
                    {"speed": 10, "max_effort": 435714.28571428574},
                    {"speed": 15, "max_effort": 427777.77777777775},
                    {"speed": 20, "max_effort": 400000.0},
                    {"speed": 22, "max_effort": 350971.5388299929},
                    {"speed": 27, "max_effort": 347206.93642395496},
                    {"speed": 32, "max_effort": 346938.7385068534},
                    {"speed": 37, "max_effort": 344395.0325320009},
                    {"speed": 42, "max_effort": 334314.2138640166},
                    {"speed": 47, "max_effort": 313589.8108101956},
                    {"speed": 52, "max_effort": 283584.5657113532},
                    {"speed": 57, "max_effort": 250604.14937613969},
                    {"speed": 62, "max_effort": 222698.71360301683},
                    {"speed": 67, "max_effort": 204685.35097358702},
                    {"speed": 72, "max_effort": 195984.55717992093},
                    {"speed": 77, "max_effort": 192916.76425246376},
                ],
            }
        ]

    def __init__(self, infra):
        self.json = dict()
        self.build_rolling_stocks()
        self.json["train_schedules"] = []
        self.lengths = infra.lengths
        self.neighboors = [[] for otrack in range(2 * infra.nb_tracks)]
        for utrack in range(infra.nb_tracks):
            self.neighboors[uget_begin(utrack)].append(uget_end(utrack))
            self.neighboors[uget_end(utrack)].append(uget_begin(utrack))
        for ofirst, osecond in infra.links:
            self.neighboors[ofirst].append(osecond)
            self.neighboors[osecond].append(ofirst)
        for obase, oleft, oright in infra.switches:
            self.neighboors[obase].append(oleft)
            self.neighboors[obase].append(oright)
            self.neighboors[oleft].append(obase)
            self.neighboors[oright].append(obase)
        self.weight = [
            infra.lengths[oget_track(otrack)] for otrack in range(2 * infra.nb_tracks)
        ]

    def route_path(self, departure_utrack, arrival_utrack):
        s1, s2 = uget_begin(departure_utrack), uget_end(departure_utrack)
        t1, t2 = uget_begin(arrival_utrack), uget_end(arrival_utrack)
        parent = [None for u in self.neighboors]
        q = [(0, s1, -1), (0, s2, -1)]
        while q != [] and parent[t1] == None and parent[t2] == None:
            d, u, p = heappop(q)
            if parent[u] == None:
                parent[u] = p
                for v in self.neighboors[u]:
                    heappush(q, (d + self.weight[v], v, u))
        path = []
        u = t1 if parent[t1] != None else t2
        while u != -1:
            path.append(u)
            u = parent[u]
        path.reverse()
        path = [oget_other_side(path[0])] + path + [oget_other_side(path[-1])]
        return [oname_route_between(path[i], path[i + 1]) for i in range(len(path) - 1)]

    def add_schedule(self, departure_time, departure_utrack, arrival_utrack, cbtc=False):
        assert departure_utrack != arrival_utrack
        path = self.route_path(departure_utrack, arrival_utrack)
        index = len(self.json["train_schedules"])
        self.json["train_schedules"].append(
            {
                "id": f"train.{index}",
                "rolling_stock": "fast_rolling_stock",
                "initial_head_location": {
                    "track_section": uname_track(departure_utrack),
                    "offset": self.lengths[departure_utrack] // 2,
                },
                "departure_time": departure_time,
                "initial_speed": 0,
                "routes": path,
                "phases": [
                    {
                        "driver_sight_distance": 400,
                        "end_location": {
                            "track_section": uname_track(arrival_utrack),
                            "offset": self.lengths[arrival_utrack] // 2,
                        },
                        "type": "cbtc" if cbtc else "navigate",
                    }
                ],
            }
        )

    def to_json(self, cbtc=False):
        """Returns the json corresponding to simulation.json

        Args:
            cbtc (bool, optional): If False, all the train with cbtc status will be remove of the simulation. Defaults to False.
        """
        schedules = self.json["train_schedules"].copy()
        if not cbtc:
            for schedule in self.json["train_schedules"]:
                for phase in schedule["phases"]:
                    if phase["type"] == "cbtc":
                        schedules.remove(schedule)
        simulation = self.json.copy()
        simulation["train_schedules"] = schedules
        return simulation


class Succession:
    def __init__(self):
        self.json = {"successions": []}

    def add_table(self, ubase, uleft, uright, trains):
        self.json["successions"].append(
            {
                "switch": uname_switch(ubase, uleft, uright),
                "table": [f"train.{index}" for index in trains],
            }
        )

    def to_json(self):
        return self.json


CONFIG_JSON = {
    "simulation_time_step": 1,
    "infra_path": "infra.json",
    "simulation_path": "simulation.json",
    "succession_path": "succession.json",
    "show_viewer": True,
    "realtime_viewer": True,
    "change_replay_check": True,
    "simulation_step_pause": 0.02,
}

CONFIG_CBTC_JSON = {
    "simulation_time_step": 1,
    "infra_path": "infra_cbtc.json",
    "simulation_path": "simulation_cbtc.json",
    "succession_path": "succession.json",
    "show_viewer": True,
    "realtime_viewer": True,
    "change_replay_check": True,
    "simulation_step_pause": 0.02,
}
