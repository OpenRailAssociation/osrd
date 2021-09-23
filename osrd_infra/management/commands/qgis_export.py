from django.core.management.base import BaseCommand, CommandError
from django.contrib.gis.geos import LineString
from osrd_infra.models import SwitchEntity, fetch_entities, Endpoint, TrackSectionLinkEntity
from pathlib import Path
import csv

from osrd_infra.models import (
    Infra,
    TrackSectionEntity,
    WaypointEntity,
    SignalEntity,
    TVDSectionEntity,
    OperationalPointPartEntity,
)


def formatter(name, prefetch=None):
    def _wrapper(f):
        nonlocal prefetch
        f.name = name
        if prefetch is None:
            prefetch = []
        elif isinstance(prefetch, str):
            prefetch = [prefetch]
        f.prefetch = prefetch
        return f

    return _wrapper


@formatter("osrd_id")
def format_osrd_id(entity):
    return str(entity.entity_id)


@formatter("point_geo", prefetch="geo_point_location")
def format_point_geo(entity):
    return str(entity.geo_point_location.geographic)


@formatter("point_sch", prefetch="geo_point_location")
def format_point_sch(entity):
    return str(entity.geo_point_location.schematic)


@formatter("line_geo", prefetch="geo_line_location")
def format_line_geo(entity):
    return str(entity.geo_line_location.geographic)


@formatter("line_sch", prefetch="geo_line_location")
def format_line_sch(entity):
    return str(entity.geo_line_location.schematic)


@formatter("lines_geo", prefetch="geo_lines_location")
def format_lines_geo(entity):
    return str(entity.geo_lines_location.geographic)


@formatter("lines_sch", prefetch="geo_lines_location")
def format_lines_sch(entity):
    return str(entity.geo_lines_location.schematic)


@formatter("identifiers", prefetch="identifier_set")
def format_identifiers(entity):
    return ",".join(
        f"{identifier.database}:{identifier.name}"
        for identifier in entity.identifier_set.all()
    )


@formatter("op_name")
def format_operational_point(entity):
    op = entity.operational_point_part.operational_point
    return op.operational_point.name


def dump_entities(writer, entities, formatters):
    prefetch = []
    for formatter in formatters:
        prefetch.extend(formatter.prefetch)

    writer.writerow((f.name for f in formatters))
    for entity in entities.prefetch_related(*prefetch):
        writer.writerow((f(entity) for f in formatters))


def get_geo_point_near_endpoint(track_id, endpoint, cached_track_sections):
    track_entity = cached_track_sections[track_id]
    length = track_entity.track_section.length
    endpoint = Endpoint(endpoint)
    offset = min(0.5, 5 / length)
    if endpoint == Endpoint.END:
        offset = 1 - offset
    geo_line = track_entity.geo_line_location.geographic
    return geo_line.interpolate_normalized(offset)


def make_link(cached_track_sections, src_track, src_endpoint, dst_track, dst_endpoint):
    origin = get_geo_point_near_endpoint(src_track, src_endpoint, cached_track_sections)
    destination = get_geo_point_near_endpoint(dst_track, dst_endpoint, cached_track_sections)
    line = LineString(origin, destination)
    return line


def export_track_section_links(fp, namespace, cached_track_sections):
    writer = csv.writer(fp)
    writer.writerow(["id", "track_section_link"])
    for track_section_link_entity in TrackSectionLinkEntity.objects.filter(namespace=namespace):
        link = track_section_link_entity.track_section_link
        line = make_link(
            cached_track_sections,
            link.begin_track_section_id,
            link.begin_endpoint,
            link.end_track_section_id,
            link.end_endpoint,
        )
        writer.writerow([track_section_link_entity.entity_id, line])


def export_switches(fp, namespace, cached_track_sections):
    writer = csv.writer(fp)
    writer.writerow(["id", "switch_link"])
    for switch_entity in SwitchEntity.objects.filter(namespace=namespace):
        for link in switch_entity.switch.links:
            line = make_link(
                cached_track_sections,
                link["origin"]["track_section"],
                link["origin"]["endpoint"],
                link["destination"]["track_section"],
                link["destination"]["endpoint"]
            )
            writer.writerow([switch_entity.entity_id, line])


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
        infra_namespace = infra.namespace_id

        query = fetch_entities(TrackSectionEntity, namespace=infra_namespace)
        cached_track_sections = {entity.entity_id: entity for entity in query}

        # make the output directory
        out_dir = Path(options["out_dir"])
        out_dir.mkdir(parents=True, exist_ok=True)

        with (out_dir / "track_section_links.csv").open("w") as fp:
            export_track_section_links(fp, infra_namespace, cached_track_sections)

        with (out_dir / "switches.csv").open("w") as fp:
            export_switches(fp, infra_namespace, cached_track_sections)

        with (out_dir / "track_sections.csv").open("w") as fp:
            dump_entities(
                csv.writer(fp),
                TrackSectionEntity.objects.filter(namespace=infra_namespace),
                [format_osrd_id, format_line_geo, format_line_sch, format_identifiers],
            )

        with (out_dir / "waypoints.csv").open("w") as fp:
            dump_entities(
                csv.writer(fp),
                WaypointEntity.objects.filter(namespace=infra_namespace),
                [
                    format_osrd_id,
                    format_point_geo,
                    format_point_sch,
                    format_identifiers,
                ],
            )

        with (out_dir / "signals.csv").open("w") as fp:
            dump_entities(
                csv.writer(fp),
                SignalEntity.objects.filter(namespace=infra_namespace),
                [
                    format_osrd_id,
                    format_point_geo,
                    format_point_sch,
                    format_identifiers,
                ],
            )

        with (out_dir / "tvd_sections.csv").open("w") as fp:
            dump_entities(
                csv.writer(fp),
                TVDSectionEntity.objects.filter(namespace=infra_namespace),
                [
                    format_osrd_id,
                    format_lines_geo,
                    format_lines_sch,
                    format_identifiers,
                ],
            )

        with (out_dir / "operational_points.csv").open("w") as fp:
            dump_entities(
                csv.writer(fp),
                OperationalPointPartEntity.objects.filter(namespace=infra_namespace),
                [
                    format_osrd_id,
                    format_point_geo,
                    format_point_sch,
                    format_operational_point,
                ],
            )
