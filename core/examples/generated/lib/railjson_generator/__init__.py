import sys
from pathlib import Path

api_schema_parent_path = Path(__file__).parents[5] / "python" / "osrd_schemas" 
assert api_schema_parent_path.exists()
sys.path.append(str(api_schema_parent_path))

from .infra_builder import InfraBuilder  # noqa
from .external_generated_inputs import ExternalGeneratedInputs  # noqa
from .simulation_builder import SimulationBuilder  # noqa
from .schema.infra.direction import ApplicableDirection  # noqa
from .schema.location import Location  # noqa


def get_output_dir() -> Path:
    return Path(sys.argv[1])
