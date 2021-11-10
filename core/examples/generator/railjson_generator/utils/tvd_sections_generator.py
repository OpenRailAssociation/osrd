from collections import defaultdict
from typing import Mapping

from railjson_generator.schema.infra.infra import Infra
from railjson_generator.schema.infra.tvd_section import TVDSection

from railjson_generator.utils.union_find import UnionFind


def create_uf(infra: Infra, indices: Mapping[str, int]):
    uf = UnionFind(len(infra.track_sections) * 2)

    for track in infra.track_sections:
        if track.waypoints:
            continue
        uf.union(track.begin().index, track.end().index)

    for link in infra.links:
        uf.union(link.begin.index, link.end.index)

    return uf


def generate_tvd_sections(infra):
    # Clear tvd sections
    infra.tvd_sections.clear()

    # Create inner tvd sections
    for track in infra.track_sections:
        for i in range(1, len(track.waypoints)):
            prev_waypoint = track.waypoints[i - 1]
            cur_waypoint = track.waypoints[i]
            tvd = infra.add_tvd_section()
            tvd.add_waypoints(prev_waypoint, cur_waypoint)
            prev_waypoint.right_tvd = tvd
            cur_waypoint.left_tvd = tvd

    indices = {track.label: i for i, track in enumerate(infra.track_sections)}
    uf = create_uf(infra, indices)

    tvd_sections: Mapping[int, TVDSection] = defaultdict(infra.add_tvd_section)

    for track in infra.track_sections:
        if not track.waypoints:
            continue

        start_tvd_section = tvd_sections[uf.find(track.begin().index)]
        end_tvd_section = tvd_sections[uf.find(track.end().index)]
        first_waypoint = track.waypoints[0]
        last_waypoint = track.waypoints[-1]

        start_tvd_section.add_waypoints(first_waypoint)
        first_waypoint.left_tvd = start_tvd_section
        last_waypoint.right_tvd = end_tvd_section
        if len(track.waypoints) > 1 or start_tvd_section is not end_tvd_section:
            end_tvd_section.add_waypoints(last_waypoint)
