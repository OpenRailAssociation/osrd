package fr.sncf.osrd;

import static fr.sncf.osrd.infra.trackgraph.TrackSection.linkEdges;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.infra.trackgraph.*;
import fr.sncf.osrd.utils.SortedArraySet;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;

public class RouteGraphTest {

    private static void checkRoute(
            Route route,
            int expectedTvdSectionPath,
            double expectedLength,
            Waypoint expectedStart,
            Waypoint expectedEnd
    ) {
        assertEquals(expectedLength, route.length, 0.1);
        assertEquals(expectedTvdSectionPath, route.tvdSectionsPaths.size());

        var start = route.tvdSectionsPaths.get(0).startNode;
        if (route.tvdSectionsPathDirections.get(0) == EdgeDirection.STOP_TO_START)
             start = route.tvdSectionsPaths.get(0).endNode;
        assertEquals(expectedStart.index, start);

        var lastIndex = expectedTvdSectionPath - 1;
        var end = route.tvdSectionsPaths.get(lastIndex).endNode;
        if (route.tvdSectionsPathDirections.get(lastIndex) == EdgeDirection.STOP_TO_START)
             end = route.tvdSectionsPaths.get(lastIndex).startNode;
        assertEquals(expectedEnd.index, end);
    }

    private static Route makeRoute(
            RouteGraph.Builder builder,
            String id,
            ArrayList<Waypoint> waypoints,
            SortedArraySet<TVDSection> tvdSections,
            HashMap<Switch, SwitchPosition> switchPositions
    ) throws InvalidInfraException {
        // Create a "flexible transit" release group
        var releaseGroups = new ArrayList<SortedArraySet<TVDSection>>();
        for (var tvdSection : tvdSections) {
            var releaseGroup = new SortedArraySet<TVDSection>();
            releaseGroup.add(tvdSection);
            releaseGroups.add(releaseGroup);
        }

        return builder.makeRoute(id, tvdSections, releaseGroups, switchPositions, waypoints.get(0), null);
    }

    private static Route makeRoute(
            RouteGraph.Builder builder,
            String id,
            ArrayList<Waypoint> waypoints,
            SortedArraySet<TVDSection> tvdSections
    ) throws InvalidInfraException {
        return makeRoute(builder, id, waypoints, tvdSections, null);
    }

    /**
     * One tiv with 2 routes
     *         R1
     * A   ----------->   B
     * |---D1---D2---D3---|
     *     <-----------
     *         R2
     */
    @Test
    public void simpleRouteGraphBuild() throws InvalidInfraException {
        // Craft trackGraph
        var trackGraph = new TrackGraph();
        var nodeA = trackGraph.makePlaceholderNode("A");
        var nodeB = trackGraph.makePlaceholderNode("B");
        var trackSection = trackGraph.makeTrackSection(nodeA.index, nodeB.index, "e1", 100, null);
        var detectorBuilder = trackSection.waypoints.builder();
        var d1 = new Detector(0, "D1");
        var d2 = new Detector(1, "D2");
        var d3 = new Detector(2, "D3");
        detectorBuilder.add(40, d1);
        detectorBuilder.add(50, d2);
        detectorBuilder.add(75, d3);
        detectorBuilder.build();

        // Craft tvdSections
        var tvdSections = new HashMap<String, TVDSection>();
        var tvd123Waypoints = new ArrayList<Waypoint>(Arrays.asList(d1, d2, d3));
        var tvdSection123 = new TVDSection("TVDSection123", 0, tvd123Waypoints, false);
        tvdSections.put("TVDSection123", tvdSection123);

        // Build DetectorGraph
        var waypointGraph = Infra.buildWaypointGraph(trackGraph, tvdSections);

        // Build RouteGraph
        var routeGraphBuilder = new RouteGraph.Builder(waypointGraph);

        var waypointsR1 = new ArrayList<Waypoint>(Arrays.asList(d1, d2, d3));
        var tvdSectionsR1 = new SortedArraySet<TVDSection>();
        tvdSectionsR1.add(tvdSection123);
        final var route1 = makeRoute(routeGraphBuilder, "R1", waypointsR1, tvdSectionsR1);

        var waypointsR2 = new ArrayList<Waypoint>(Arrays.asList(d3, d2, d1));
        var tvdSectionsR2 = new SortedArraySet<TVDSection>();
        tvdSectionsR2.add(tvdSection123);
        final var route2 = makeRoute(routeGraphBuilder, "R2", waypointsR2, tvdSectionsR2);

        var routeGraph =  routeGraphBuilder.build();

        assertEquals(2, routeGraph.getEdgeCount());

        checkRoute(route1, 2, 35, d1, d3);
        checkRoute(route2, 2, 35, d3, d1);
    }

    /**
     * Complex track graph. Points A, B and D are buffer stops.
     *                R1
     *    —————————————————————,
     *   A   foo_a        D1    \               R4
     *   +—————————————————o——,  +—> <————————————————————————————————
     *                    D2   \   D3                      D4
     *   +—————————————————o————+——o————————————————————————o————————+
     *   B    foo_b             C           track                    D
     *    —————————————————————————> ————————————————————————————————>
     *              R2                             R3
     */
    @Test
    public void complexRouteGraphBuild() throws InvalidInfraException {
        // Craft trackGraph
        var trackGraph = new TrackGraph();
        var nodeA = trackGraph.makePlaceholderNode("A");
        var nodeB = trackGraph.makePlaceholderNode("B");
        var nodeC = trackGraph.makePlaceholderNode("C");
        var nodeD = trackGraph.makePlaceholderNode("D");
        var fooA = trackGraph.makeTrackSection(nodeA.index, nodeC.index, "foo_a", 75, null);
        var fooB = trackGraph.makeTrackSection(nodeB.index, nodeC.index, "foo_b", 75, null);
        var track = trackGraph.makeTrackSection(nodeC.index, nodeD.index, "track", 100, null);

        linkEdges(fooA, EdgeEndpoint.END, track, EdgeEndpoint.BEGIN);
        linkEdges(fooB, EdgeEndpoint.END, track, EdgeEndpoint.BEGIN);

        var index = 0;

        var middleSwitch = trackGraph.makeSwitchNode(nodeC.index, "switch", 0, 0);
        middleSwitch.leftTrackSection = fooA;
        middleSwitch.rightTrackSection = fooB;

        final var bsA = new BufferStop(index++, "BS_A");
        final var d1 = new Detector(index++, "D1");
        var detectorBuilder = fooA.waypoints.builder();
        detectorBuilder.add(0, bsA);
        detectorBuilder.add(40, d1);
        detectorBuilder.build();

        final var bsB = new BufferStop(index++, "BS_B");
        final var d2 = new Detector(index++, "D2");
        detectorBuilder = fooB.waypoints.builder();
        detectorBuilder.add(0, bsB);
        detectorBuilder.add(40, d2);
        detectorBuilder.build();

        final var d3 = new Detector(index++, "D3");
        final var d4 = new Detector(index++, "D4");
        final var bsD = new BufferStop(index, "BS_D");
        detectorBuilder = track.waypoints.builder();
        detectorBuilder.add(25, d3);
        detectorBuilder.add(75, d4);
        detectorBuilder.add(100, bsD);
        detectorBuilder.build();

        // Craft tvdSections
        index = 0;
        var tvdSections = new HashMap<String, TVDSection>();

        var tvdWaypoints123 = new ArrayList<Waypoint>(Arrays.asList(d1, d2, d3));
        var tvdSection123 = new TVDSection("TVDSection123", index++, tvdWaypoints123, false);
        tvdSections.put("TVDSection123", tvdSection123);

        var tvdFooWaypoints1A = new ArrayList<>(Arrays.asList(d1, bsA));
        var tvdSection1A = new TVDSection("TVDSection1A", index++, tvdFooWaypoints1A, true);
        tvdSections.put("TVDSection1A", tvdSection1A);

        var tvdFooWaypoints2B = new ArrayList<>(Arrays.asList(d2, bsB));
        var tvdSection2B = new TVDSection("TVDSection2B", index++, tvdFooWaypoints2B, true);
        tvdSections.put("TVDSection2B", tvdSection2B);

        var tvdFooWaypoints34D = new ArrayList<>(Arrays.asList(d3, d4, bsD));
        var tvdSection34D = new TVDSection("TVDSection34D", index, tvdFooWaypoints34D, true);
        tvdSections.put("TVDSection34D", tvdSection34D);

        // Build DetectorGraph
        var waypointGraph = Infra.buildWaypointGraph(trackGraph, tvdSections);

        var switchPositionLeft = new HashMap<Switch, SwitchPosition>();
        var switchPositionRight = new HashMap<Switch, SwitchPosition>();
        switchPositionLeft.put(middleSwitch, SwitchPosition.LEFT);
        switchPositionRight.put(middleSwitch, SwitchPosition.RIGHT);

        // Build RouteGraph
        var routeGraphBuilder = new RouteGraph.Builder(waypointGraph);

        var waypointsR1 = new ArrayList<>(Arrays.asList(bsA, d1, d3));
        var tvdSectionsR1 = new SortedArraySet<TVDSection>();
        tvdSectionsR1.add(tvdSection123);
        tvdSectionsR1.add(tvdSection1A);
        final var route1 = makeRoute(routeGraphBuilder, "R1", waypointsR1, tvdSectionsR1, switchPositionLeft);

        var waypointsR2 = new ArrayList<>(Arrays.asList(bsB, d2, d3));
        var tvdSectionsR2 = new SortedArraySet<TVDSection>();
        tvdSectionsR2.add(tvdSection123);
        tvdSectionsR2.add(tvdSection2B);
        final var route2 = makeRoute(routeGraphBuilder, "R2", waypointsR2, tvdSectionsR2, switchPositionRight);

        var waypointsR3 = new ArrayList<>(Arrays.asList(d3, d4, bsD));
        var tvdSectionsR3 = new SortedArraySet<TVDSection>();
        tvdSectionsR3.add(tvdSection34D);
        final var route3 = makeRoute(routeGraphBuilder, "R3", waypointsR3, tvdSectionsR3);

        var waypointsR4 = new ArrayList<>(Arrays.asList(bsD, d4, d3));
        var tvdSectionsR4 = new SortedArraySet<TVDSection>();
        tvdSectionsR4.add(tvdSection34D);
        final var route4 = makeRoute(routeGraphBuilder, "R4", waypointsR4, tvdSectionsR4);

        var routeGraph =  routeGraphBuilder.build();

        assertEquals(4, routeGraph.getEdgeCount());

        checkRoute(route1, 2, 100, bsA, d3);
        checkRoute(route2, 2, 100, bsB, d3);
        checkRoute(route3, 2, 75, d3, bsD);
        checkRoute(route4, 2, 75, bsD, d3);
    }
}
