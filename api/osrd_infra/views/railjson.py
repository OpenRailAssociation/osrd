import logging
from typing import Type

from osrd_infra.models import (
    AspectModel,
    BufferStopModel,
    DetectorModel,
    Infra,
    OperationalPointModel,
    RailScriptFunctionModel,
    RouteModel,
    SignalModel,
    SwitchModel,
    SwitchTypeModel,
    TrackSectionLinkModel,
    TrackSectionModel,
    TVDSectionModel,
)
from osrd_infra.models.schemas import RAILJSON_VERSION, RailJsonInfra
from osrd_infra.utils import Benchmarker

logger = logging.getLogger(__name__)


def fetch_model(model_type: Type, infra: Infra):
    return list(map(model_type.into_obj, model_type.objects.filter(infra=infra)))


def railjson_serialize_infra(infra: Infra):
    bench = Benchmarker()
    exclude_keys = {}
    exclude_geometry = {"__all__": {"geo", "sch"}}

    bench.step("fetch operational points")
    operational_points = fetch_model(OperationalPointModel, infra)
    exclude_keys["operational_points"] = {"__all__": {"parts": exclude_geometry}}

    bench.step("fetch routes")
    routes = fetch_model(RouteModel, infra)
    exclude_keys["routes"] = exclude_geometry

    bench.step("fetch switch types")
    switch_types = fetch_model(SwitchTypeModel, infra)

    bench.step("fetch switches")
    switches = fetch_model(SwitchModel, infra)
    exclude_keys["switches"] = exclude_geometry

    bench.step("fetch track section links")
    track_section_links = fetch_model(TrackSectionLinkModel, infra)

    bench.step("fetch track sections")
    track_sections = fetch_model(TrackSectionModel, infra)
    exclude_keys["track_sections"] = exclude_geometry

    bench.step("fetch signals")
    signals = fetch_model(SignalModel, infra)
    exclude_keys["signals"] = exclude_geometry

    bench.step("fetch buffer stops")
    buffer_stops = fetch_model(BufferStopModel, infra)
    exclude_keys["buffer_stops"] = exclude_geometry

    bench.step("fetch detectors")
    detectors = fetch_model(DetectorModel, infra)
    exclude_keys["detectors"] = exclude_geometry

    bench.step("fetch tvd sections")
    tvd_sections = fetch_model(TVDSectionModel, infra)
    exclude_keys["tvd_sections"] = exclude_geometry

    bench.step("fetch railscript functions")
    script_functions = []
    for rs_fct in RailScriptFunctionModel.objects.filter(infra=infra):
        script_functions.append(rs_fct.data)

    bench.step("fetch aspects")
    aspects = []
    for rs_fct in AspectModel.objects.filter(infra=infra):
        aspects.append(rs_fct.data)

    bench.step("serialize")
    railjson_infra = RailJsonInfra(
        version=RAILJSON_VERSION,
        operational_points=operational_points,
        routes=routes,
        switch_types=switch_types,
        switches=switches,
        track_section_links=track_section_links,
        track_sections=track_sections,
        signals=signals,
        buffer_stops=buffer_stops,
        detectors=detectors,
        tvd_sections=tvd_sections,
        script_functions=script_functions,
        aspects=aspects,
    )
    res = railjson_infra.dict(exclude=exclude_keys)

    bench.stop()
    bench.print_steps(logger.info)
    return res
