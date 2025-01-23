#!/usr/bin/env python3

from railjson_generator import get_output_dir
from small_infra_creator import create_small_infra

OUTPUT_DIR = get_output_dir()

scenario_data = create_small_infra(signaling_system="BAL")

# Save files
scenario_data.infra.save(OUTPUT_DIR / "infra.json")
scenario_data.external_inputs.save(OUTPUT_DIR / "external_generated_inputs.json")
