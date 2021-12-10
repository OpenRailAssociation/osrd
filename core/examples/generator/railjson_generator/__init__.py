import sys
from pathlib import Path

schema_path = Path(__file__).parents[4] / "api" / "osrd_infra" / "models"
sys.path.append(str(schema_path))

from railjson_generator.infra_builder import InfraBuilder  # noqa
from railjson_generator.simulation_builder import SimulationBuilder  # noqa
from railjson_generator.schema.infra.direction import ApplicableDirection  # noqa
from railjson_generator.schema.location import Location  # noqa
