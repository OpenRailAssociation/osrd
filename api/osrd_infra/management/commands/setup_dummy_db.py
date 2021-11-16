import json

from django.core.management.base import BaseCommand
from pathlib import Path

from osrd_infra.models import (
    RollingStock,
    TrackSectionEntity,
    Infra,
    EntityNamespace,
    TrackSectionComponent,
    WaypointEntity,
    WaypointComponent,
    WaypointType,
    ApplicableDirectionComponent,
    ApplicableDirection,
    TrackSectionLocationComponent,
    RouteEntity,
    RouteComponent,
    TVDSectionEntity,
    BerthingComponent,
    BelongsToTVDSectionComponent,
    ReleaseGroupComponent
)
from utils.entity_creator import EntityCreator


class Command(BaseCommand):
    help = "Generates a basic DB setup for unit tests"

    def handle(self, *args, **options):
        existing = RollingStock.objects.filter(name="fast_rolling_stock").first()
        if existing is not None:
            existing.delete()
        if RollingStock.objects.count() == 0 or True:
            rolling_stock_path = Path(__file__).parents[3] / "static" / "example_rolling_stock.json"
            with open(rolling_stock_path.resolve(), "r") as f:
                RollingStock.from_railjson(json.load(f))

        if Infra.objects.count() == 0:
            infra_namespace = EntityNamespace.objects.create()
            Infra.objects.create(
                name="dummy_infra",
                owner="00000000-0000-0000-0000-000000000000",
                namespace=infra_namespace,
            )
            with EntityCreator(TrackSectionEntity, infra_namespace) as track_creator:
                track_section = track_creator.create_entity()
                track_section.components.append(
                    TrackSectionComponent(
                        length=1000,
                        line_code=42,
                        line_name="foo",
                        track_number=43,
                        track_name="track",
                    )
                )
            with EntityCreator(TVDSectionEntity, infra_namespace) as tvd_creator:
                tvd_section = tvd_creator.create_entity()
                tvd_section.add_component(BerthingComponent(is_berthing=False))
            with EntityCreator(WaypointEntity, infra_namespace) as waypoint_creator:
                waypoints = list()
                for offset in [0, 1000]:
                    waypoint = waypoint_creator.create_entity()
                    waypoint.add_component(WaypointComponent(waypoint_type=WaypointType.BUFFER_STOP))
                    waypoint.add_component(ApplicableDirectionComponent(applicable_direction=ApplicableDirection.BOTH))
                    waypoint.add_component(
                        TrackSectionLocationComponent(track_section=track_section.entity, offset=offset)
                    )
                    waypoint.add_component(
                        BelongsToTVDSectionComponent(tvd_section=tvd_section.entity)
                    )
                    waypoints.append(waypoint)
            with EntityCreator(RouteEntity, infra_namespace) as route_creator:
                for direction in ApplicableDirection.NORMAL, ApplicableDirection.REVERSE:
                    route_entity = route_creator.create_entity()
                    route_entity.add_component(
                        RouteComponent(
                            entry_point=waypoints[0 if direction is ApplicableDirection.NORMAL else 1].entity,
                            exit_point=waypoints[0 if direction is ApplicableDirection.REVERSE else 1].entity,
                            entry_direction=direction,
                        )
                    )
                    release_group = route_entity.add_component(ReleaseGroupComponent())
                    route_creator.create_m2m_relation(
                        ReleaseGroupComponent.tvd_sections, release_group, tvd_section.entity
                    )
            print(infra_namespace)
