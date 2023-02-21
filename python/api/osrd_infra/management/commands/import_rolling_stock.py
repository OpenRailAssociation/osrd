import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db.utils import IntegrityError

from osrd_infra.models import RollingStock


class Command(BaseCommand):
    help = "Import a given rolling stock json file"

    def add_arguments(self, parser):
        parser.add_argument("path", type=str)
        parser.add_argument("-f", action="store_true", help="Overwrite if exists")

    def handle(self, *args, **options):
        # Get argumentas and options
        rolling_stock_path = Path(options["path"])
        force = options["f"]

        # Check path is valid
        if not rolling_stock_path.is_file():
            raise CommandError(f"'{options['path']}' is not a file")

        # Deserialize railjson
        with open(rolling_stock_path) as f:
            rolling_stock = json.load(f)

        try:
            rolling_stock = RollingStock.import_railjson(rolling_stock, force)
        except IntegrityError:
            raise CommandError(f"Rolling stock with id '{rolling_stock['name']}' already exists")
