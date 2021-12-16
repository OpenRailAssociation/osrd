import json
from dataclasses import dataclass
from typing import List, Type

from django.contrib.gis.geos import GEOSGeometry, LineString

from osrd_infra.models import (
    Infra,
    OperationalPointModel,
    SignalModel,
    TrackSectionModel,
    TVDSectionModel,
)
from osrd_infra.schemas.infra import TrackSection
from osrd_infra.utils import track_section_range_geom

from .layer_creator import LayerCreator


@dataclass
class CachedTrackSection:
    track: TrackSection
    geo: LineString
    sch: LineString


def generate_layers(infra: Infra):
    generate_generic_layer(infra, TrackSectionModel)
    generate_generic_layer(infra, SignalModel)
    generate_generic_layer(infra, TVDSectionModel)

    generate_operational_point_layer(infra)

    # Cache all track sections
    cached_track_sections = []
    for track in TrackSectionModel.objects.filter(infra=infra):
        track = track.into_obj()
        cached_track_sections.append(
            CachedTrackSection(track, GEOSGeometry(track.geo.json()), GEOSGeometry(track.sch.json()))
        )

    generate_speed_layer(infra, cached_track_sections)
    generate_signaling_layer(infra, cached_track_sections)
    generate_catenary_layer(infra, cached_track_sections)


def generate_generic_layer(infra: Infra, model_type: Type):
    layer_name = model_type._meta.verbose_name_plural.replace(" ", "_")
    with LayerCreator(layer_name, infra.id) as creator:
        for entity in model_type.objects.filter(infra=infra):
            creator.add(entity.data)


def generate_operational_point_layer(infra: Infra):
    with LayerCreator("operational_points", infra.id) as creator:
        for op in OperationalPointModel.objects.filter(infra=infra):
            op_obj = op.into_obj()
            op_data = op_obj.dict(exclude={"parts"})
            for part in op_obj.parts:
                creator.add({**op_data, **part.dict()})


def generate_speed_layer(infra: Infra, cached_track_sections: List[CachedTrackSection]):
    with LayerCreator("speed_sections", infra.id) as creator:
        for cached_track in cached_track_sections:
            for i, speed_section in enumerate(cached_track.track.speed_sections):
                geo, sch = track_section_range_geom(
                    cached_track.track.length,
                    cached_track.geo,
                    cached_track.sch,
                    speed_section.begin,
                    speed_section.end,
                )
                creator.add(
                    {
                        "id": f"{cached_track.track.id}.{i}",
                        "geo": json.loads(geo.json),
                        "sch": json.loads(sch.json),
                        "track": cached_track.track.ref().dict(),
                        **speed_section.dict(),
                    }
                )


def generate_signaling_layer(infra: Infra, cached_track_sections: List[CachedTrackSection]):
    with LayerCreator("signaling_sections", infra.id) as creator:
        for cached_track in cached_track_sections:
            for i, signaling_section in enumerate(cached_track.track.signaling_sections):
                geo, sch = track_section_range_geom(
                    cached_track.track.length,
                    cached_track.geo,
                    cached_track.sch,
                    signaling_section.begin,
                    signaling_section.end,
                )
                creator.add(
                    {
                        "id": f"{cached_track.track.id}.{i}",
                        "geo": json.loads(geo.json),
                        "sch": json.loads(sch.json),
                        "track": cached_track.track.ref().dict(),
                        **signaling_section.dict(),
                    }
                )


def generate_catenary_layer(infra: Infra, cached_track_sections: List[CachedTrackSection]):
    with LayerCreator("catenary_sections", infra.id) as creator:
        for cached_track in cached_track_sections:
            for i, catenary_section in enumerate(cached_track.track.catenary_sections):
                geo, sch = track_section_range_geom(
                    cached_track.track.length,
                    cached_track.geo,
                    cached_track.sch,
                    catenary_section.begin,
                    catenary_section.end,
                )
                creator.add(
                    {
                        "id": f"{cached_track.track.id}.{i}",
                        "geo": json.loads(geo.json),
                        "sch": json.loads(sch.json),
                        "track": cached_track.track.ref().dict(),
                        **catenary_section.dict(),
                    }
                )
