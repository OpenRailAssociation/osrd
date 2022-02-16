import sys
from pathlib import Path

schema_path = Path(__file__).parents[5] / "api" / "osrd_infra" / "schemas"
assert schema_path.exists()
sys.path.append(str(schema_path))

from railjson_generator.infra_builder import InfraBuilder  # noqa
from railjson_generator.simulation_builder import SimulationBuilder  # noqa
from railjson_generator.schema.infra.direction import ApplicableDirection  # noqa
from railjson_generator.schema.location import Location  # noqa

def get_output_dir() -> Path:
    return Path(sys.argv[1])