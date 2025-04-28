#!/usr/bin/env python3

"""
This script generates an infrastructure containing ERTMS ETCS Level 2 and BAL signals.
This is derived from small_infra.
"""

import sys
from pathlib import Path

from small_infra_creator import create_small_infra

signaling_systems = {
    "WS": "BAL",
    "SWS": "BAL",
    "MWS": "BAL",
    "MES": "ETCS_LEVEL2",
    "NS": "ETCS_LEVEL2",
    "SS": "ETCS_LEVEL2",
    "NES": "ETCS_LEVEL2",
    "SES": "ETCS_LEVEL2",
}

scenario_data = create_small_infra(signaling_systems)

if __name__ == "__main__":
    scenario_data.infra.save(Path(sys.argv[1]) / "infra.json")
    scenario_data.external_inputs.save(
        Path(sys.argv[1]) / "external_generated_inputs.json"
    )
