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

import java.util.*;

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
            HashMap<Switch, String> switchGroups
    ) throws InvalidInfraException {
        // Create a "flexible transit" release group
        var releaseGroups = new ArrayList<SortedArraySet<TVDSection>>();
        for (var tvdSection : tvdSections) {
            var releaseGroup = new SortedArraySet<TVDSection>();
            releaseGroup.add(tvdSection);
            releaseGroups.add(releaseGroup);
        }

        return builder.makeRoute(id, tvdSections, releaseGroups, switchGroups, waypoints.get(0), null, null);
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

        var middleSwitch = trackGraph.makeSwitchNode(
                nodeC.index,
                "switch",
                0,
                0,
                new ArrayList<>(),
                new HashMap<>()
        );

        var portBase = new Switch.Port("base", track, EdgeEndpoint.BEGIN);
        var portLeft = new Switch.Port("left", fooA, EdgeEndpoint.END);
        var portRight = new Switch.Port("right", fooB, EdgeEndpoint.END);

        middleSwitch.ports.add(portBase);
        middleSwitch.ports.add(portLeft);
        middleSwitch.ports.add(portRight);
        middleSwitch.groups.put(
                "LEFT",
                List.of(
                    new Switch.PortEdge(portBase, portLeft),
                    new Switch.PortEdge(portLeft, portBase)
                )
        );
        middleSwitch.groups.put(
                "RIGHT",
                List.of(
                    new Switch.PortEdge(portBase, portRight),
                    new Switch.PortEdge(portRight, portBase)
                )
        );

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

        var switchGroupLeft = new HashMap<Switch, String>();
        var switchGroupRight = new HashMap<Switch, String>();
        switchGroupLeft.put(middleSwitch, "LEFT");
        switchGroupRight.put(middleSwitch, "RIGHT");

        // Build RouteGraph
        var routeGraphBuilder = new RouteGraph.Builder(waypointGraph);

        var waypointsR1 = new ArrayList<>(Arrays.asList(bsA, d1, d3));
        var tvdSectionsR1 = new SortedArraySet<TVDSection>();
        tvdSectionsR1.add(tvdSection123);
        tvdSectionsR1.add(tvdSection1A);
        final var route1 = makeRoute(routeGraphBuilder, "R1", waypointsR1, tvdSectionsR1, switchGroupLeft);

        var waypointsR2 = new ArrayList<>(Arrays.asList(bsB, d2, d3));
        var tvdSectionsR2 = new SortedArraySet<TVDSection>();
        tvdSectionsR2.add(tvdSection123);
        tvdSectionsR2.add(tvdSection2B);
        final var route2 = makeRoute(routeGraphBuilder, "R2", waypointsR2, tvdSectionsR2, switchGroupRight);

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

    @Test
    @SuppressWarnings("checkstyle:VariableDeclarationUsageDistance")
    public void triangularTVDSection() throws InvalidInfraException {
        // Craft trackGraph
        var trackGraph = new TrackGraph();
        var nodeInnerA = trackGraph.makePlaceholderNode("innerA");
        var nodeInnerB = trackGraph.makePlaceholderNode("innerB");
        var nodeInnerC = trackGraph.makePlaceholderNode("innerC");
        var nodeOuterA = trackGraph.makePlaceholderNode("outerA");
        var nodeOuterB = trackGraph.makePlaceholderNode("outerB");
        var nodeOuterC = trackGraph.makePlaceholderNode("outerC");
        var trackSectionA = trackGraph.makeTrackSection(nodeOuterA.index, nodeInnerA.index, "eA", 100, null);
        var trackSectionB = trackGraph.makeTrackSection(nodeOuterB.index, nodeInnerB.index, "eB", 100, null);
        var trackSectionC = trackGraph.makeTrackSection(nodeOuterC.index, nodeInnerC.index, "eC", 100, null);
        var trackSectionAB = trackGraph.makeTrackSection(nodeInnerA.index, nodeInnerB.index, "AB", 100, null);
        var trackSectionBC = trackGraph.makeTrackSection(nodeInnerB.index, nodeInnerC.index, "BC", 100, null);
        var trackSectionCA = trackGraph.makeTrackSection(nodeInnerC.index, nodeInnerA.index, "CA", 100, null);
        var detectorBuilderA = trackSectionA.waypoints.builder();
        var detectorBuilderB = trackSectionB.waypoints.builder();
        var detectorBuilderC = trackSectionC.waypoints.builder();
        var da = new Detector(0, "DA");
        var db = new Detector(1, "DB");
        var dc = new Detector(2, "DC");
        detectorBuilderA.add(50, da);
        detectorBuilderB.add(50, db);
        detectorBuilderC.add(50, dc);
        detectorBuilderA.build();
        detectorBuilderB.build();
        detectorBuilderC.build();

        linkEdges(trackSectionA, EdgeEndpoint.END, trackSectionAB, EdgeEndpoint.BEGIN);
        linkEdges(trackSectionA, EdgeEndpoint.END, trackSectionCA, EdgeEndpoint.END);
        linkEdges(trackSectionB, EdgeEndpoint.END, trackSectionBC, EdgeEndpoint.BEGIN);
        linkEdges(trackSectionB, EdgeEndpoint.END, trackSectionAB, EdgeEndpoint.END);
        linkEdges(trackSectionC, EdgeEndpoint.END, trackSectionCA, EdgeEndpoint.BEGIN);
        linkEdges(trackSectionC, EdgeEndpoint.END, trackSectionBC, EdgeEndpoint.END);

        var baseA = new Switch.Port("base", trackSectionA, EdgeEndpoint.END);
        var leftA = new Switch.Port("left", trackSectionAB, EdgeEndpoint.BEGIN);
        var rightA = new Switch.Port("right", trackSectionCA, EdgeEndpoint.END);
        var baseB = new Switch.Port("base", trackSectionB, EdgeEndpoint.END);
        var leftB = new Switch.Port("left", trackSectionBC, EdgeEndpoint.BEGIN);
        var rightB = new Switch.Port("right", trackSectionAB, EdgeEndpoint.END);
        var baseC = new Switch.Port("base", trackSectionC, EdgeEndpoint.END);
        var leftC = new Switch.Port("left", trackSectionCA, EdgeEndpoint.BEGIN);
        var rightC = new Switch.Port("right", trackSectionBC, EdgeEndpoint.END);

        var portsA = List.of(baseA, leftA, rightA);
        var groupsA = Map.of(
                "LEFT",
                List.of(new Switch.PortEdge(baseA, leftA), new Switch.PortEdge(leftA, baseA)),
                "RIGHT",
                List.of(new Switch.PortEdge(baseA, rightA), new Switch.PortEdge(rightA, baseA))
        );

        var portsB = List.of(baseB, leftB, rightB);
        var groupsB = Map.of(
                "LEFT",
                List.of(new Switch.PortEdge(baseB, leftB), new Switch.PortEdge(leftB, baseB)),
                "RIGHT",
                List.of(new Switch.PortEdge(baseB, rightB), new Switch.PortEdge(rightB, baseB))
        );

        var portsC = List.of(baseC, leftC, rightC);
        var groupsC = Map.of(
                "LEFT",
                List.of(new Switch.PortEdge(baseC, leftC), new Switch.PortEdge(leftC, baseC)),
                "RIGHT",
                List.of(new Switch.PortEdge(baseC, rightC), new Switch.PortEdge(rightC, baseC))
        );

        var switchA = trackGraph.makeSwitchNode(nodeInnerA.index, "switchA", 0, 0, portsA, groupsA);
        var switchB = trackGraph.makeSwitchNode(nodeInnerB.index, "switchB", 1, 0, portsB, groupsB);
        var switchC = trackGraph.makeSwitchNode(nodeInnerC.index, "switchC", 2, 0, portsC, groupsC);

        // Craft tvdSections
        var tvdSectionsMap = new HashMap<String, TVDSection>();
        var tvdSectionsSet = new SortedArraySet<TVDSection>();
        var tvd123Waypoints = new ArrayList<Waypoint>(Arrays.asList(da, db, dc));
        var tvdSection123 = new TVDSection("TVDSectionABC", 0, tvd123Waypoints, false);
        tvdSectionsMap.put("TVDSectionABC", tvdSection123);
        tvdSectionsSet.addAll(tvdSectionsMap.values());
        var releaseGroups = Collections.singletonList(tvdSectionsSet);

        // Build DetectorGraph
        var waypointGraph = Infra.buildWaypointGraph(trackGraph, tvdSectionsMap);

        // Build RouteGraph
        var routeGraphBuilder = new RouteGraph.Builder(waypointGraph);

        var switchGroupsR1 = new HashMap<Switch, String>();
        switchGroupsR1.put(switchA, "RIGHT");
        switchGroupsR1.put(switchB, "LEFT");
        routeGraphBuilder.makeRoute("R1", tvdSectionsSet, releaseGroups, switchGroupsR1,
                da, null, null);
        var switchGroupsR2 = new HashMap<Switch, String>();
        switchGroupsR2.put(switchB, "RIGHT");
        switchGroupsR2.put(switchC, "LEFT");
        routeGraphBuilder.makeRoute("R2", tvdSectionsSet, releaseGroups, switchGroupsR2,
                db, null, null);
        var switchGroupsR3 = new HashMap<Switch, String>();
        switchGroupsR3.put(switchC, "RIGHT");
        switchGroupsR3.put(switchA, "LEFT");
        routeGraphBuilder.makeRoute("R3", tvdSectionsSet, releaseGroups, switchGroupsR3,
                dc, null, null);
    }
}
