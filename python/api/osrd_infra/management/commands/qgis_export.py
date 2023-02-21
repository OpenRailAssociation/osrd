import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable

from django.contrib.gis.geos import GEOSGeometry, LineString, Point
from django.core.management.base import BaseCommand, CommandError
from osrd_schemas.infra import Endpoint, TrackLocationTrait, TrackSection

from osrd_infra.models import (
    BufferStopModel,
    DetectorModel,
    Infra,
    OperationalPointModel,
    SignalModel,
    SwitchModel,
    TrackSectionLinkModel,
    TrackSectionModel,
)


@dataclass
class CustomOperationalPointPart:
    geo: Point
    sch: Point
    name: str
    id: str


def formatter(name):
    def _wrapper(f):
        f.name = name
        return f

    return _wrapper


@formatter("osrd_id")
def format_osrd_id(obj, **kwargs):
    return obj.id


@formatter("name")
def format_name(obj, **kwargs):
    return obj.name


@formatter("geo")
def format_geo_point(obj, **kwargs):
    return GEOSGeometry(obj.geo.json).ewkt


@formatter("sch")
def format_sch_point(obj, **kwargs):
    return GEOSGeometry(obj.sch.json).ewkt


@formatter("geo")
def format_geo(obj, **kwargs):
    return GEOSGeometry(obj.geo.json()).ewkt


@formatter("sch")
def format_sch(obj, **kwargs):
    return GEOSGeometry(obj.sch.json()).ewkt


@formatter("geo")
def compute_geo_from_location(obj: TrackLocationTrait, **kwargs):
    return interpolate_location(obj, kwargs["tracks"], True).ewkt


@formatter("sch")
def compute_sch_from_location(obj: TrackLocationTrait, **kwargs):
    return interpolate_location(obj, kwargs["tracks"], False).ewkt


@formatter("op_name")
def format_operational_point(entity, **kwargs):
    op = entity.operational_point_part.operational_point
    return op.operational_point.name


@formatter("aspects")
def format_aspects(signal, **kwargs):
    return ";".join(signal.aspects or [])


def dump_entities(writer, objects, formatters, **kwargs):
    writer.writerow((f.name for f in formatters))
    for obj in objects:
        writer.writerow((f(obj, **kwargs) for f in formatters))


def interpolate_location_with_track(offset: float, track: TrackSection, geo: bool) -> Point:
    data = track.geo if geo else track.sch
    geo_line = GEOSGeometry(data.json())
    normalized = 0 if track.length == 0 else offset / track.length
    return geo_line.interpolate_normalized(normalized)


def interpolate_location(obj: TrackLocationTrait, tracks: Dict[str, TrackSection], geo: bool) -> Point:
    track = tracks[obj.track.id]
    return interpolate_location_with_track(obj.position, track, geo)


def get_geo_point_near_endpoint(track, endpoint):
    length = track.length
    offset = min(0.5, 5 / length) if length > 0 else 0
    if endpoint == Endpoint.END:
        offset = 1 - offset
    geo_line = GEOSGeometry(track.geo.json())
    return geo_line.interpolate_normalized(offset)


def compute_link_geom(src_track, src_endpoint, dst_track, dst_endpoint):
    origin = get_geo_point_near_endpoint(src_track, src_endpoint)
    destination = get_geo_point_near_endpoint(dst_track, dst_endpoint)
    line = LineString(origin, destination)
    return line


def export_track_section_links(fp, infra, track_sections):
    writer = csv.writer(fp)
    writer.writerow(["id", "geo"])
    for link in TrackSectionLinkModel.objects.filter(infra=infra):
        link = link.into_obj()
        line = compute_link_geom(
            track_sections[link.src.track.id],
            link.src.endpoint,
            track_sections[link.dst.track.id],
            link.dst.endpoint,
        )
        writer.writerow((link.id, line.ewkt))


def export_switches(fp, infra, track_sections):
    writer = csv.writer(fp)
    writer.writerow(["id", "switch_link"])
    for switch in SwitchModel.objects.filter(infra=infra):
        switch = switch.into_obj()
        if switch.switch_type.id != "classic":
            continue
        line = compute_link_geom(
            track_sections[switch.ports["BASE"].track.id],
            switch.ports["BASE"].endpoint,
            track_sections[switch.ports["LEFT"].track.id],
            switch.ports["LEFT"].endpoint,
        )
        writer.writerow([switch.id, line.ewkt])
        line = compute_link_geom(
            track_sections[switch.ports["BASE"].track.id],
            switch.ports["BASE"].endpoint,
            track_sections[switch.ports["RIGHT"].track.id],
            switch.ports["RIGHT"].endpoint,
        )
        writer.writerow([switch.id, line.ewkt])


def export_loading_gauges(fp, track_sections: Iterable[TrackSection]):
    writer = csv.writer(fp)
    writer.writerow(["geo", "sch", "applicable", "category"])
    for track in track_sections:
        for gauge in track.loading_gauge_limits:
            geo = LineString(
                interpolate_location_with_track(gauge.begin, track, True),
                interpolate_location_with_track(gauge.end, track, True),
            )
            sch = LineString(
                interpolate_location_with_track(gauge.begin, track, False),
                interpolate_location_with_track(gauge.end, track, False),
            )
            writer.writerow((geo.ewkt, sch.ewkt, gauge.applicable_train_type, gauge.category))


class Command(BaseCommand):
    help = "Dumps the database into something QGis can import"

    def add_arguments(self, parser):
        parser.add_argument("infra_id", type=int)
        parser.add_argument("out_dir", type=str)

    def handle(self, *args, **options):
        # get the infrastructure
        try:
            infra_id = options["infra_id"]
            infra = Infra.objects.get(pk=infra_id)
        except Infra.DoesNotExist:
            raise CommandError('Infra "%s" does not exist' % infra_id)

        # make the output directory
        out_dir = Path(options["out_dir"])
        out_dir.mkdir(parents=True, exist_ok=True)

        track_sections = {}
        for track in TrackSectionModel.objects.filter(infra=infra):
            track = track.into_obj()
            track_sections[track.id] = track

        with (out_dir / "track_sections.csv").open("w") as fp:
            dump_entities(
                csv.writer(fp),
                track_sections.values(),
                [format_osrd_id, format_geo, format_sch],
            )

        buffer_stops = [w.into_obj() for w in DetectorModel.objects.filter(infra=infra)]
        with (out_dir / "detectors.csv").open("w") as fp:
            dump_entities(
                csv.writer(fp),
                buffer_stops,
                [format_osrd_id, compute_geo_from_location, compute_sch_from_location],
                tracks=track_sections,
            )

        buffer_stops = [w.into_obj() for w in BufferStopModel.objects.filter(infra=infra)]
        with (out_dir / "buffer_stops.csv").open("w") as fp:
            dump_entities(
                csv.writer(fp),
                buffer_stops,
                [format_osrd_id, compute_geo_from_location, compute_sch_from_location],
                tracks=track_sections,
            )

        signals = [w.into_obj() for w in SignalModel.objects.filter(infra=infra)]
        with (out_dir / "signals.csv").open("w") as fp:
            dump_entities(
                csv.writer(fp),
                signals,
                [format_osrd_id, compute_geo_from_location, compute_sch_from_location, format_aspects],
                tracks=track_sections,
            )

        operational_points = []
        for op in OperationalPointModel.objects.filter(infra=infra):
            op = op.into_obj()
            for part in op.parts:
                operational_points.append(
                    CustomOperationalPointPart(
                        interpolate_location(part, track_sections, True),
                        interpolate_location(part, track_sections, False),
                        op.name,
                        op.id,
                    )
                )

        with (out_dir / "operational_points.csv").open("w") as fp:
            dump_entities(
                csv.writer(fp),
                operational_points,
                [format_osrd_id, format_geo_point, format_sch_point, format_name],
            )

        with (out_dir / "track_section_links.csv").open("w") as fp:
            export_track_section_links(fp, infra, track_sections)

        with (out_dir / "switches.csv").open("w") as fp:
            export_switches(fp, infra, track_sections)

        with (out_dir / "loading_gauges.csv").open("w") as fp:
            export_loading_gauges(fp, track_sections.values())
