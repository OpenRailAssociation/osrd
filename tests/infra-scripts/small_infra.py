#!/usr/bin/env python3

import sys
from pathlib import Path

from small_infra_creator import create_small_infra

scenario_data = create_small_infra(signaling_system="BAL")

if __name__ == "__main__":
    scenario_data.infra.save(Path(sys.argv[1]) / "infra.json")
    scenario_data.external_inputs.save(
        Path(sys.argv[1]) / "external_generated_inputs.json"
    )
