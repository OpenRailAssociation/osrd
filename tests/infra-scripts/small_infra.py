#!/usr/bin/env python3

import sys
from pathlib import Path

from small_infra_creator import create_small_infra

signaling_systems = {
    "WS": "BAL",
    "SWS": "BAL",
    "MWS": "BAL",
    "MES": "BAL",
    "NS": "BAL",
    "SS": "BAL",
    "NES": "BAL",
    "SES": "BAL",
}

scenario_data = create_small_infra(signaling_systems)

if __name__ == "__main__":
    scenario_data.infra.save(Path(sys.argv[1]) / "infra.json")
    scenario_data.external_inputs.save(
        Path(sys.argv[1]) / "external_generated_inputs.json"
    )
