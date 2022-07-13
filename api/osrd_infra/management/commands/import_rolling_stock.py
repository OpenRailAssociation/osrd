import json
from pathlib import Path

from django.core.management.base import BaseCommand

from osrd_infra.models import RollingStock


class Command(BaseCommand):
    help = "Import a given rolling stock json file"

    def add_arguments(self, parser):
        parser.add_argument('path', type=str)

    def handle(self, *args, **options):
        rolling_stock_path = Path(options["path"])
        with open(rolling_stock_path.resolve(), "r") as f:
            json_data = json.load(f)
            existing = RollingStock.objects.filter(name=json_data["id"]).first()
            if existing is not None:
                existing.delete()
            res = RollingStock.from_railjson(json_data)
            print(res)
