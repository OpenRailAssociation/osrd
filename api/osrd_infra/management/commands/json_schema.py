from django.core.management.base import BaseCommand, CommandError

from osrd_infra.schemas.infra import RailJsonInfra
from osrd_infra.schemas.rolling_stock import RollingStock


class Command(BaseCommand):
    help = "Print a given schema"

    def add_arguments(self, parser):
        parser.add_argument("schema", type=str)

    def handle(self, *args, **options):
        schema = options["schema"].lower()

        AVAILABLE_SCHEMAS = {
            "infra": RailJsonInfra,
            "rolling_stock": RollingStock,
        }

        if schema not in AVAILABLE_SCHEMAS:
            raise CommandError(f"Invalid schema '{schema}', expected one of [{', '.join(AVAILABLE_SCHEMAS.keys())}]")

        print(AVAILABLE_SCHEMAS[schema].schema())
