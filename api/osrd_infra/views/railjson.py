from pathlib import Path
from typing import Type

from django.db import connection

from osrd_infra.models import Infra

CURRENT_DIR = Path(__file__).parent
GET_INFRA_SQL = open(CURRENT_DIR / "get_infra.sql").read()


def fetch_data(model_type: Type, infra: Infra):
    return [model.data for model in model_type.objects.filter(infra=infra)]


def railjson_serialize_infra(infra: Infra):
    with connection.cursor() as cursor:
        cursor.execute(GET_INFRA_SQL, [infra.id])
        res = cursor.fetchone()[0]
    return res
