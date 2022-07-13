import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from osrd_infra.views.railjson import import_infra


class Command(BaseCommand):
    help = "Import an infra from a railjson file"

    def add_arguments(self, parser):
        parser.add_argument("infra_name", type=str)
        parser.add_argument("railjson_path", type=str)

    def handle(self, *args, **options):
        railjson_path = Path(options["railjson_path"])

        # Check path is valid
        if not railjson_path.is_file():
            raise CommandError(f"{options['railjson_path']} is not a file")

        # Deserialize railjson
        with open(railjson_path) as f:
            railjson = json.load(f)

        infra = import_infra(railjson, options["infra_name"])
        print(f"Import succeful! New infra has id: {infra.id}")
