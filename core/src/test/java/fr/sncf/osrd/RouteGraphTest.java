package fr.sncf.osrd;

import static fr.sncf.osrd.Helpers.*;
import static fr.sncf.osrd.infra.trackgraph.TrackSection.linkEdges;
import static fr.sncf.osrd.utils.graph.EdgeDirection.START_TO_STOP;
import static org.junit.jupiter.api.Assertions.assertEquals;

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

        var start = route.tvdSectionsPaths.get(0).startWaypoint;
        assertEquals(expectedStart.index, start.index);

        var lastIndex = expectedTvdSectionPath - 1;
        var end = route.tvdSectionsPaths.get(lastIndex).endWaypoint;
        assertEquals(expectedEnd.index, end.index);
    }

    private static Route makeRoute(
            RouteGraph.Builder builder,
            String id,
            ArrayList<Waypoint> waypoints,
            EdgeDirection entryDirection,
            SortedArraySet<TVDSection> tvdSections,
            HashMap<Switch, String> switchGroups
    ) throws InvalidInfraException {
        // Create a "flexible transit" release group
        var releaseDetectors = new HashSet<Waypoint>();
        for (int i = 1; i < waypoints.size() - 1; i++)
            releaseDetectors.add(waypoints.get(i));

        return builder.makeRoute(id, switchGroups, waypoints.get(0),
                waypoints.get(waypoints.size() - 1), null, entryDirection, releaseDetectors);
    }

    private static Route makeRoute(
            RouteGraph.Builder builder,
            String id,
            ArrayList<Waypoint> waypoints,
            EdgeDirection entryDirection,
            SortedArraySet<TVDSection> tvdSections
    ) throws InvalidInfraException {
        return makeRoute(builder, id, waypoints, entryDirection, tvdSections, null);
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
        var trackSection = trackGraph.makeTrackSection(nodeA.index, nodeB.index, "e1", 100);
        var detectorBuilder = trackSection.waypoints.builder();
        var d1 = new Detector(0, "D1");
        var d2 = new Detector(1, "D2");
        var d3 = new Detector(2, "D3");
        detectorBuilder.add(40, d1);
        detectorBuilder.add(50, d2);
        detectorBuilder.add(75, d3);
        detectorBuilder.build();

        // Craft tvdSections
        var tvd12 = makeTVDSection(d1, d2);
        assignAfterTVDSection(tvd12, d1);
        assignBeforeTVDSection(tvd12, d2);
        var tvd23 = makeTVDSection(d2, d3);
        assignAfterTVDSection(tvd23, d2);
        assignBeforeTVDSection(tvd23, d3);

        var tvdSections = new SortedArraySet<TVDSection>();
        tvdSections.add(tvd12);
        tvdSections.add(tvd23);

        // Build RouteGraph
        var routeGraphBuilder = new RouteGraph.Builder(trackGraph, 3);

        var waypointsR1 = new ArrayList<Waypoint>(Arrays.asList(d1, d2, d3));
        final var route1 = makeRoute(routeGraphBuilder, "R1", waypointsR1,
                START_TO_STOP, tvdSections);

        var waypointsR2 = new ArrayList<Waypoint>(Arrays.asList(d3, d2, d1));
        final var route2 = makeRoute(routeGraphBuilder, "R2", waypointsR2,
                EdgeDirection.STOP_TO_START, tvdSections);

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
        var fooA = trackGraph.makeTrackSection(nodeA.index, nodeC.index, "foo_a", 75);
        var fooB = trackGraph.makeTrackSection(nodeB.index, nodeC.index, "foo_b", 75);
        var track = trackGraph.makeTrackSection(nodeC.index, nodeD.index, "track", 100);

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
        final var bsD = new BufferStop(index++, "BS_D");
        detectorBuilder = track.waypoints.builder();
        detectorBuilder.add(25, d3);
        detectorBuilder.add(75, d4);
        detectorBuilder.add(100, bsD);
        detectorBuilder.build();

        // Craft tvdSections
        final var tvdSection123 = makeTVDSection(d1, d2, d3);
        assignAfterTVDSection(tvdSection123, d1, d2);
        assignBeforeTVDSection(tvdSection123, d3);
        final var tvdSection1A = makeTVDSection(d1, bsA);
        assignAfterTVDSection(tvdSection1A, bsA);
        assignBeforeTVDSection(tvdSection1A, d1);
        final var tvdSection2B = makeTVDSection(d2, bsB);
        assignAfterTVDSection(tvdSection2B, bsB);
        assignBeforeTVDSection(tvdSection2B, d2);
        final var tvdSection34 = makeTVDSection(d3, d4);
        assignAfterTVDSection(tvdSection34, d3);
        assignBeforeTVDSection(tvdSection34, d4);
        final var tvdSection4D = makeTVDSection(d4, bsD);
        assignAfterTVDSection(tvdSection4D, d4);
        assignBeforeTVDSection(tvdSection4D, bsD);

        var switchGroupLeft = new HashMap<Switch, String>();
        var switchGroupRight = new HashMap<Switch, String>();
        switchGroupLeft.put(middleSwitch, "LEFT");
        switchGroupRight.put(middleSwitch, "RIGHT");

        // Build RouteGraph
        var routeGraphBuilder = new RouteGraph.Builder(trackGraph, index);

        var waypointsR1 = new ArrayList<>(Arrays.asList(bsA, d1, d3));
        var tvdSectionsR1 = new SortedArraySet<TVDSection>();
        tvdSectionsR1.add(tvdSection123);
        tvdSectionsR1.add(tvdSection1A);
        final var route1 = makeRoute(routeGraphBuilder, "R1", waypointsR1,
                START_TO_STOP, tvdSectionsR1, switchGroupLeft);

        var waypointsR2 = new ArrayList<>(Arrays.asList(bsB, d2, d3));
        var tvdSectionsR2 = new SortedArraySet<TVDSection>();
        tvdSectionsR2.add(tvdSection123);
        tvdSectionsR2.add(tvdSection2B);
        final var route2 = makeRoute(routeGraphBuilder, "R2", waypointsR2,
                START_TO_STOP, tvdSectionsR2, switchGroupRight);

        var waypointsR3 = new ArrayList<>(Arrays.asList(d3, d4, bsD));
        var tvdSectionsR3 = new SortedArraySet<TVDSection>();
        tvdSectionsR3.add(tvdSection34);
        tvdSectionsR3.add(tvdSection4D);
        final var route3 = makeRoute(routeGraphBuilder, "R3", waypointsR3,
                START_TO_STOP, tvdSectionsR3);

        var waypointsR4 = new ArrayList<>(Arrays.asList(bsD, d4, d3));
        var tvdSectionsR4 = new SortedArraySet<TVDSection>();
        tvdSectionsR4.add(tvdSection34);
        tvdSectionsR4.add(tvdSection4D);
        final var route4 = makeRoute(routeGraphBuilder, "R4", waypointsR4,
                EdgeDirection.STOP_TO_START, tvdSectionsR4);

        var routeGraph =  routeGraphBuilder.build();

        assertEquals(4, routeGraph.getEdgeCount());

        checkRoute(route1, 2, 100, bsA, d3);
        checkRoute(route2, 2, 100, bsB, d3);
        checkRoute(route3, 2, 75, d3, bsD);
        checkRoute(route4, 2, 75, bsD, d3);
    }

    /** Left and right switch positions are defined when looking from the outside of the triangle
     *                      +  outerA
     *                      |
     *                   DA o  |
     *                      |  v
     *                      |
     *               innerA +
     *                     / \
     *                 ^  /   \  |
     *                 | /     \ v
     *           ->     /       \     <-
     * outerC +-o------+---------+---------o-+ outerB
     *          DC   innerC <- innerB      DB
     *
     */
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
        var trackSectionA = trackGraph.makeTrackSection(nodeOuterA.index, nodeInnerA.index, "eA", 100);
        var trackSectionB = trackGraph.makeTrackSection(nodeOuterB.index, nodeInnerB.index, "eB", 100);
        var trackSectionC = trackGraph.makeTrackSection(nodeOuterC.index, nodeInnerC.index, "eC", 100);
        var trackSectionAB = trackGraph.makeTrackSection(nodeInnerA.index, nodeInnerB.index, "AB", 100);
        var trackSectionBC = trackGraph.makeTrackSection(nodeInnerB.index, nodeInnerC.index, "BC", 100);
        var trackSectionAC = trackGraph.makeTrackSection(nodeInnerC.index, nodeInnerA.index, "CA", 100);

        var detectorBuilderA = trackSectionA.waypoints.builder();
        var da = new Detector(0, "DA");
        detectorBuilderA.add(50, da);
        detectorBuilderA.build();

        var detectorBuilderB = trackSectionB.waypoints.builder();
        var db = new Detector(1, "DB");
        detectorBuilderB.add(50, db);
        detectorBuilderB.build();

        var detectorBuilderC = trackSectionC.waypoints.builder();
        var dc = new Detector(2, "DC");
        detectorBuilderC.add(50, dc);
        detectorBuilderC.build();

        linkEdges(trackSectionA, EdgeEndpoint.END, trackSectionAB, EdgeEndpoint.BEGIN);
        linkEdges(trackSectionA, EdgeEndpoint.END, trackSectionAC, EdgeEndpoint.END);
        linkEdges(trackSectionB, EdgeEndpoint.END, trackSectionBC, EdgeEndpoint.BEGIN);
        linkEdges(trackSectionB, EdgeEndpoint.END, trackSectionAB, EdgeEndpoint.END);
        linkEdges(trackSectionC, EdgeEndpoint.END, trackSectionAC, EdgeEndpoint.BEGIN);
        linkEdges(trackSectionC, EdgeEndpoint.END, trackSectionBC, EdgeEndpoint.END);

        var baseA = new Switch.Port("base", trackSectionA, EdgeEndpoint.END);
        var leftA = new Switch.Port("left", trackSectionAB, EdgeEndpoint.BEGIN);
        var rightA = new Switch.Port("right", trackSectionAC, EdgeEndpoint.END);
        var baseB = new Switch.Port("base", trackSectionB, EdgeEndpoint.END);
        var leftB = new Switch.Port("left", trackSectionBC, EdgeEndpoint.BEGIN);
        var rightB = new Switch.Port("right", trackSectionAB, EdgeEndpoint.END);
        var baseC = new Switch.Port("base", trackSectionC, EdgeEndpoint.END);
        var leftC = new Switch.Port("left", trackSectionAC, EdgeEndpoint.BEGIN);
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
        var tvdSection123 = makeTVDSection(da, db, dc);
        assignAfterTVDSection(tvdSection123, da, db, dc);

        // Build RouteGraph
        var routeGraphBuilder = new RouteGraph.Builder(trackGraph, 3);

        var switchGroupsR1 = new HashMap<Switch, String>();
        switchGroupsR1.put(switchA, "LEFT");
        switchGroupsR1.put(switchB, "RIGHT");
        routeGraphBuilder.makeRoute("R1", switchGroupsR1, da, db, null, START_TO_STOP, new HashSet<>());
        var switchGroupsR2 = new HashMap<Switch, String>();
        switchGroupsR2.put(switchB, "LEFT");
        switchGroupsR2.put(switchC, "RIGHT");
        routeGraphBuilder.makeRoute("R2", switchGroupsR2, db, dc, null, START_TO_STOP, new HashSet<>());
        var switchGroupsR3 = new HashMap<Switch, String>();
        switchGroupsR3.put(switchC, "LEFT");
        switchGroupsR3.put(switchA, "RIGHT");
        routeGraphBuilder.makeRoute("R3", switchGroupsR3, dc, da, null, START_TO_STOP, new HashSet<>());
    }
}
