from pathlib import Path
from typing import List, Mapping

from django.db import connection, transaction

from osrd_infra.models import AspectModel, Infra, RailScriptFunctionModel
from osrd_infra.schemas.infra import BaseObjectTrait, RailJsonInfra

CURRENT_DIR = Path(__file__).parent
GET_INFRA_SQL = open(CURRENT_DIR / "get_infra.sql").read()


def serialize_infra(infra: Infra):
    with connection.cursor() as cursor:
        cursor.execute(GET_INFRA_SQL, [infra.id])
        res = cursor.fetchone()[0]
    return res


def import_objects(objects: List[BaseObjectTrait], infra: Infra):
    models = [obj.into_model(infra) for obj in objects]
    if models:
        model_type = type(models[0])
        model_type.objects.bulk_create(models)


@transaction.atomic
def import_infra(railjson: Mapping, infra_name: str):
    # Parse railjson payload
    railjson = RailJsonInfra.parse_obj(railjson)

    # Create infra
    infra = Infra.objects.create(name=infra_name)

    # Import base objects
    import_objects(railjson.operational_points, infra)
    import_objects(railjson.routes, infra)
    import_objects(railjson.switch_types, infra)
    import_objects(railjson.switches, infra)
    import_objects(railjson.track_sections, infra)
    import_objects(railjson.signals, infra)
    import_objects(railjson.buffer_stops, infra)
    import_objects(railjson.detectors, infra)
    import_objects(railjson.tvd_sections, infra)

    # Import rail script
    script_functions = [RailScriptFunctionModel(infra=infra, data=obj) for obj in railjson.script_functions]
    RailScriptFunctionModel.objects.bulk_create(script_functions)

    aspects = [AspectModel(infra=infra, data=obj) for obj in railjson.aspects]
    AspectModel.objects.bulk_create(aspects)

    return infra
