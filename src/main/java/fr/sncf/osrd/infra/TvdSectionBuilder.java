package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.utils.UnionFind;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.function.Function;

public class TvdSectionBuilder {
    private static int getEndpointIndex(TrackSection track, EdgeEndpoint endpoint) {
        return track.index * 2 + endpoint.id;
    }

    /** Build all tvd sections and link them to waypoints */
    public static ArrayList<TVDSection> build(TrackGraph graph) {
        var tvdSections = new ArrayList<TVDSection>();

        // Create tvd section inside a track section
        for (var track : graph.trackSectionMap.values()) {
            for (int i = 1; i < track.waypoints.size(); i++) {
                var prev = track.waypoints.get(i - 1).value;
                var cur = track.waypoints.get(i).value;
                var tvdSection = new TVDSection();
                tvdSection.waypoints.add(prev);
                tvdSection.waypoints.add(cur);
                tvdSections.add(tvdSection);
                prev.afterTvdSection = tvdSection;
                cur.beforeTvdSection = tvdSection;
            }
        }

        // Create tvd sections which cross track section boundaries
        // Keep track of what tvd section each endpoint belongs to
        var uf = new UnionFind(graph.trackSectionMap.size() * 2);

        for (var track : graph.trackSectionMap.values()) {
            var beginIndex = getEndpointIndex(track, EdgeEndpoint.BEGIN);
            var endIndex = getEndpointIndex(track, EdgeEndpoint.END);
            if (track.waypoints.size() == 0)
                uf.union(beginIndex, endIndex);

            for (var neighbor : track.startNeighbors) {
                var neighborDir = neighbor.getDirection(track, EdgeDirection.STOP_TO_START);
                uf.union(beginIndex, getEndpointIndex(neighbor, EdgeEndpoint.startEndpoint(neighborDir)));
            }

            for (var neighbor : track.endNeighbors) {
                var neighborDir = neighbor.getDirection(track, EdgeDirection.START_TO_STOP);
                uf.union(endIndex, getEndpointIndex(neighbor, EdgeEndpoint.startEndpoint(neighborDir)));
            }
        }

        Function<Integer, TVDSection> createTvdSection = (groupIndex) -> {
            var tvd = new TVDSection();
            tvdSections.add(tvd);
            return tvd;
        };

        var tvdSectionsMap = new HashMap<Integer, TVDSection>();
        for (var track : graph.trackSectionMap.values()) {
            if (track.waypoints.size() == 0)
                continue;

            var beginGroupIndex = uf.findRoot(getEndpointIndex(track, EdgeEndpoint.BEGIN));
            var startTvdSection = tvdSectionsMap.computeIfAbsent(beginGroupIndex, createTvdSection);
            var firstWaypoint = track.waypoints.get(0).value;

            var endGroupIndex = uf.findRoot(getEndpointIndex(track, EdgeEndpoint.END));
            var endTvdSection = tvdSectionsMap.computeIfAbsent(endGroupIndex, createTvdSection);
            var lastWaypoint = track.waypoints.get(track.waypoints.size() - 1).value;

            // Avoid adding waypoints twice to the same tvd section
            if (track.waypoints.size() == 1 && startTvdSection == endTvdSection) {
                startTvdSection.waypoints.add(firstWaypoint);
                firstWaypoint.beforeTvdSection = startTvdSection;
                firstWaypoint.afterTvdSection = startTvdSection;
            } else {
                startTvdSection.waypoints.add(firstWaypoint);
                firstWaypoint.beforeTvdSection = startTvdSection;
                endTvdSection.waypoints.add(lastWaypoint);
                lastWaypoint.afterTvdSection = endTvdSection;
            }
        }

        var res = new ArrayList<TVDSection>();
        for (var tvdSection : tvdSections) {
            assert tvdSection.waypoints.size() != 0;
            if (tvdSection.waypoints.size() == 1) {
                // filter out tvd sections with a single waypoint
                // (those are the tiny space behind buffer stops)
                deleteTVDSection(tvdSection);
            } else {
                // make a new array for kept TVDSections, and allocate indexes
                tvdSection.index = res.size();
                res.add(tvdSection);
            }
        }
        return res;
    }

    private static void deleteTVDSection(TVDSection tvdSection) {
        for (var waypoint : tvdSection.waypoints) {
            if (waypoint.beforeTvdSection == tvdSection)
                waypoint.beforeTvdSection = null;
            if (waypoint.afterTvdSection == tvdSection)
                waypoint.afterTvdSection = null;
        }
    }
}
