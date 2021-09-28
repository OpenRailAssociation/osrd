from django.core.management.base import BaseCommand, CommandError
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

        # make the output directory
        out_dir = Path(options["out_dir"])
        out_dir.mkdir(parents=True, exist_ok=True)

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
