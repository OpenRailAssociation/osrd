package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static fr.sncf.osrd.infra.trackgraph.TrackSection.linkEdges;

import fr.sncf.osrd.infra.waypointgraph.WaypointGraph;
import fr.sncf.osrd.infra.trackgraph.BufferStop;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.TreeMap;

public class WaypointGraphTest {
    private static void checkTrackSectionRange(TrackSectionRange trackSectionRange) {
        if (trackSectionRange.direction == EdgeDirection.START_TO_STOP)
            assert trackSectionRange.getBeginPosition() <= trackSectionRange.getEndPosition();
        else
            assert trackSectionRange.getEndPosition() <= trackSectionRange.getBeginPosition();
    }

    private static void checkWaypointGraph(WaypointGraph waypointGraph) {
        for (var tvdSectionPath : waypointGraph.iterEdges()) {
            for (var trackSectionRange : tvdSectionPath.getTrackSections(EdgeDirection.START_TO_STOP))
                checkTrackSectionRange(trackSectionRange);
            for (var trackSectionRange : tvdSectionPath.getTrackSections(EdgeDirection.STOP_TO_START))
                checkTrackSectionRange(trackSectionRange);
        }
    }

    /**
     * One tiv with 3 detectors on it.
     * A                  B
     * |---D1---D2---D3---|
     */
    @Test
    public void simpleWaypointGraphBuild() {
        // Craft trackGraph
        var trackGraph = new TrackGraph();
        var nodeA = trackGraph.makePlaceholderNode("A");
        var nodeB = trackGraph.makePlaceholderNode("B");
        var trackSection = trackGraph.makeTrackSection(nodeA.index, nodeB.index, "e1", 100, null);
        var detectorBuilder = trackSection.waypoints.builder();
        detectorBuilder.add(40, new Detector(0, "D1"));
        detectorBuilder.add(50, new Detector(1, "D2"));
        detectorBuilder.add(75, new Detector(2, "D3"));
        detectorBuilder.build();

        // Build DetectorGraph
        var waypointGraph = WaypointGraph.buildDetectorGraph(trackGraph);

        // Check Detector Graph
        assertEquals(3, waypointGraph.waypointNodeMap.size());
        assertEquals(2, waypointGraph.tvdSectionPathMap.size());

        var tvdSectionD1D2 = waypointGraph.getTVDSectionPath(0, 1);
        var tvdSectionD2D3 = waypointGraph.getTVDSectionPath(1, 2);
        assertEquals(10, tvdSectionD1D2.length, 0.1);
        assertEquals(25, tvdSectionD2D3.length, 0.1);

        assertEquals(1, waypointGraph.waypointNodeMap.get("D1").startToStopNeighbors.size());
        assertEquals(0, waypointGraph.waypointNodeMap.get("D1").stopToStartNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D2").startToStopNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D2").stopToStartNeighbors.size());
        assertEquals(0, waypointGraph.waypointNodeMap.get("D3").startToStopNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D3").stopToStartNeighbors.size());

        checkWaypointGraph(waypointGraph);
    }

    /**
     * Complex track graph. Points A, B and D are buffer stops.
     *   A   foo_a        D1
     *   +—————————————————o——,
     *                    D2   \   D3                      D4
     *   +—————————————————o————+——o————————————————————————o————————+
     *   B      ^               C           ^                        D
     *        foo_b                       track
     */
    @Test
    @SuppressWarnings("checkstyle:VariableDeclarationUsageDistance")
    public void complexWaypointGraphBuild() {
        // Craft trackGraph
        var trackGraph = new TrackGraph();
        var nodeA = trackGraph.makePlaceholderNode("A");
        var nodeB = trackGraph.makePlaceholderNode("B");
        var nodeC = trackGraph.makePlaceholderNode("C");
        var nodeD = trackGraph.makePlaceholderNode("D");

        // forward
        var fooA = trackGraph.makeTrackSection(nodeA.index, nodeC.index, "foo_a", 100, null);
        var detectorsFooA = fooA.waypoints.builder();
        detectorsFooA.add(75, new Detector(0, "D1"));
        detectorsFooA.add(0, new BufferStop(1, "BS_1"));
        detectorsFooA.build();

        // forward
        var fooB = trackGraph.makeTrackSection(nodeB.index, nodeC.index, "foo_b", 100, null);
        var detectorsFooB = fooB.waypoints.builder();
        detectorsFooB.add(50, new Detector(2, "D2"));
        detectorsFooB.add(0, new BufferStop(3, "BS_2"));
        detectorsFooB.build();

        // backward
        var track = trackGraph.makeTrackSection(nodeD.index, nodeC.index, "track", 500, null);
        var detectorsTrack = track.waypoints.builder();
        detectorsTrack.add(50, new Detector(4, "D4"));
        detectorsTrack.add(450, new Detector(5, "D3"));
        detectorsTrack.add(0, new BufferStop(6, "BS_3"));
        detectorsTrack.build();

        linkEdges(fooA, EdgeEndpoint.END, track, EdgeEndpoint.END);
        linkEdges(fooB, EdgeEndpoint.END, track, EdgeEndpoint.END);

        // Build DetectorGraph
        var waypointGraph = WaypointGraph.buildDetectorGraph(trackGraph);

        // Check Detector Graph
        assertEquals(7, waypointGraph.waypointNodeMap.size());
        assertEquals(6, waypointGraph.tvdSectionPathMap.size());

        var waypointsIDMap = new TreeMap<String, Integer>();

        for (int i = 1; i <= 4; i++) {
            var strI = String.format("D%d", i);
            waypointsIDMap.put(strI, waypointGraph.waypointNodeMap.get(strI).index);
        }
        for (int i = 1; i <= 3; i++) {
            var strI = String.format("BS_%d", i);
            waypointsIDMap.put(strI, waypointGraph.waypointNodeMap.get(strI).index);
        }

        var tvdSectionD1D3 = waypointGraph.getTVDSectionPath(waypointsIDMap.get("D1"), waypointsIDMap.get("D3"));
        var tvdSectionD2D3 = waypointGraph.getTVDSectionPath(waypointsIDMap.get("D2"), waypointsIDMap.get("D3"));
        var tvdSectionD3D4 = waypointGraph.getTVDSectionPath(waypointsIDMap.get("D3"), waypointsIDMap.get("D4"));
        assertEquals(75, tvdSectionD1D3.length, 0.1);
        assertEquals(100, tvdSectionD2D3.length, 0.1);
        assertEquals(400, tvdSectionD3D4.length, 0.1);

        assertEquals(1, waypointGraph.waypointNodeMap.get("D1").startToStopNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D1").stopToStartNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D2").startToStopNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D2").stopToStartNeighbors.size());
        assertEquals(2, waypointGraph.waypointNodeMap.get("D3").startToStopNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D3").stopToStartNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D4").startToStopNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D4").stopToStartNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("BS_1").startToStopNeighbors.size());
        assertEquals(0, waypointGraph.waypointNodeMap.get("BS_1").stopToStartNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("BS_2").startToStopNeighbors.size());
        assertEquals(0, waypointGraph.waypointNodeMap.get("BS_2").stopToStartNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("BS_3").startToStopNeighbors.size());
        assertEquals(0, waypointGraph.waypointNodeMap.get("BS_3").stopToStartNeighbors.size());

        checkWaypointGraph(waypointGraph);

        var tvdSectionPathD3D4 = waypointGraph.getTVDSectionPath(4, 5);
        var trackSectionsD3D4 = tvdSectionPathD3D4.getTrackSections(EdgeDirection.START_TO_STOP);
        assertEquals(1, trackSectionsD3D4.length);
        assertEquals(50., trackSectionsD3D4[0].getBeginPosition());
        assertEquals(450., trackSectionsD3D4[0].getEndPosition());
        assertEquals(EdgeDirection.START_TO_STOP, trackSectionsD3D4[0].direction);

        var trackSectionsD1D3 = tvdSectionD1D3.getTrackSections(EdgeDirection.START_TO_STOP);
        assertEquals(2, trackSectionsD1D3.length);
        assertEquals(75., trackSectionsD1D3[0].getBeginPosition());
        assertEquals(100., trackSectionsD1D3[0].getEndPosition());
        assertEquals(EdgeDirection.START_TO_STOP, trackSectionsD1D3[0].direction);

        assertEquals(500., trackSectionsD1D3[1].getBeginPosition());
        assertEquals(450., trackSectionsD1D3[1].getEndPosition());
        assertEquals(EdgeDirection.STOP_TO_START, trackSectionsD1D3[1].direction);
    }

    /**
     * Circular track graph.
     *           A +
     *            / \
     *           /   \
     *          /     \
     *      D3 O       O D1
     *        /         \
     *       /           \
     *      /             \
     *     /       D2      \
     *  C +________O________+ B
     */
    @Test
    public void circularWaypointGraphBuild() {
        // Craft trackGraph
        var trackGraph = new TrackGraph();
        var nodeA = trackGraph.makePlaceholderNode("A");
        var nodeB = trackGraph.makePlaceholderNode("B");
        var nodeC = trackGraph.makePlaceholderNode("C");

        var trackAB = trackGraph.makeTrackSection(nodeA.index, nodeB.index, "track_a_b", 100, null);
        var detectorsAB = trackAB.waypoints.builder();
        detectorsAB.add(50, new Detector(0, "D1"));
        detectorsAB.build();

        var trackBC = trackGraph.makeTrackSection(nodeB.index, nodeC.index, "track_b_c", 100, null);
        var detectorsBC = trackBC.waypoints.builder();
        detectorsBC.add(50, new Detector(1, "D2"));
        detectorsBC.build();

        var trackCA = trackGraph.makeTrackSection(nodeC.index, nodeA.index, "track_c_a", 100, null);
        var detectorsCA = trackCA.waypoints.builder();
        detectorsCA.add(50, new Detector(2, "D3"));
        detectorsCA.build();

        linkEdges(trackAB, EdgeEndpoint.END, trackBC, EdgeEndpoint.BEGIN);
        linkEdges(trackBC, EdgeEndpoint.END, trackCA, EdgeEndpoint.BEGIN);
        linkEdges(trackCA, EdgeEndpoint.END, trackAB, EdgeEndpoint.BEGIN);

        // Build DetectorGraph
        var waypointGraph = WaypointGraph.buildDetectorGraph(trackGraph);

        // Check Detector Graph
        assertEquals(3, waypointGraph.waypointNodeMap.size());
        assertEquals(3, waypointGraph.tvdSectionPathMap.size());

        var tvdSectionD1D2 = waypointGraph.getTVDSectionPath(0, 1);
        var tvdSectionD2D3 = waypointGraph.getTVDSectionPath(1, 2);
        var tvdSectionD3D1 = waypointGraph.getTVDSectionPath(2, 0);
        assertEquals(100, tvdSectionD1D2.length, 0.1);
        assertEquals(100, tvdSectionD2D3.length, 0.1);
        assertEquals(100, tvdSectionD3D1.length, 0.1);

        assertEquals(1, waypointGraph.waypointNodeMap.get("D1").startToStopNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D1").stopToStartNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D2").startToStopNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D2").stopToStartNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D3").startToStopNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D3").stopToStartNeighbors.size());

        checkWaypointGraph(waypointGraph);
    }

    /**
     * Circular track graph connecting both ends of a detector
     *           A +
     *            / \
     *           /   \
     *          /     \
     *         /       \
     *        /         \
     *       /           \
     *      /             \
     *     /       D1      \
     *  C +________O________+ B
     */
    @Test
    public void selfCircleLoop() {
        var trackGraph = new TrackGraph();
        var nodeA = trackGraph.makePlaceholderNode("A");
        var nodeB = trackGraph.makePlaceholderNode("B");
        var nodeC = trackGraph.makePlaceholderNode("C");

        var trackAB = trackGraph.makeTrackSection(nodeA.index, nodeB.index, "track_a_b", 100, null);
        var trackBC = trackGraph.makeTrackSection(nodeB.index, nodeC.index, "track_b_c", 100, null);
        var trackCA = trackGraph.makeTrackSection(nodeC.index, nodeA.index, "track_c_a", 100, null);

        linkEdges(trackAB, EdgeEndpoint.END, trackBC, EdgeEndpoint.BEGIN);
        linkEdges(trackBC, EdgeEndpoint.END, trackCA, EdgeEndpoint.BEGIN);
        linkEdges(trackCA, EdgeEndpoint.END, trackAB, EdgeEndpoint.BEGIN);

        var detectorsAB = trackAB.waypoints.builder();
        detectorsAB.add(50, new Detector(0, "D1"));
        detectorsAB.build();

        // Build DetectorGraph
        var waypointGraph = WaypointGraph.buildDetectorGraph(trackGraph);

        // Check Detector Graph
        assertEquals(1, waypointGraph.waypointNodeMap.size());
        assertEquals(1, waypointGraph.tvdSectionPathMap.size());

        var tvdSectionD1D1 = waypointGraph.getTVDSectionPath(0, 0);
        assertEquals(300, tvdSectionD1D1.length, 0.1);

        assertEquals(1, waypointGraph.waypointNodeMap.get("D1").startToStopNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D1").stopToStartNeighbors.size());

        checkWaypointGraph(waypointGraph);
    }

    /**
     * Circular track graph connecting both ends of a detector
     * If trackLoop is true, the ABC triangle is also a loop.
     *                 A +
     *                  / \
     *                 /   \
     *                /     \
     *          D1   /       \
     *   D +----O---+---------+ B
     *              C
     */
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    public void balloonLoop(boolean trackLoop) {
        var trackGraph = new TrackGraph();
        var nodeA = trackGraph.makePlaceholderNode("A");
        var nodeB = trackGraph.makePlaceholderNode("B");
        var nodeC = trackGraph.makePlaceholderNode("C");
        var nodeD = trackGraph.makePlaceholderNode("D");

        final var trackAB = trackGraph.makeTrackSection(nodeA.index, nodeB.index, "track_a_b", 100, null);
        final var trackCA = trackGraph.makeTrackSection(nodeC.index, nodeA.index, "track_c_a", 100, null);
        final var trackBC = trackGraph.makeTrackSection(nodeB.index, nodeC.index, "track_b_c", 100, null);
        final var trackCD = trackGraph.makeTrackSection(nodeC.index, nodeD.index, "track_c_d", 100, null);

        linkEdges(trackAB, EdgeEndpoint.END, trackBC, EdgeEndpoint.BEGIN);
        linkEdges(trackCA, EdgeEndpoint.END, trackAB, EdgeEndpoint.BEGIN);
        if (trackLoop)
            linkEdges(trackBC, EdgeEndpoint.END, trackCA, EdgeEndpoint.BEGIN);
        linkEdges(trackCD, EdgeEndpoint.BEGIN, trackBC, EdgeEndpoint.END);
        linkEdges(trackCD, EdgeEndpoint.BEGIN, trackCA, EdgeEndpoint.BEGIN);

        var detectorsCD = trackCD.waypoints.builder();
        detectorsCD.add(10, new Detector(0, "D1"));
        detectorsCD.build();

        // Build DetectorGraph
        var waypointGraph = WaypointGraph.buildDetectorGraph(trackGraph);

        // Check Detector Graph
        assertEquals(1, waypointGraph.waypointNodeMap.size());
        assertEquals(1, waypointGraph.tvdSectionPathMap.size());

        var tvdSectionD1D1 = waypointGraph.getTVDSectionPath(0, 0);
        assertEquals(320, tvdSectionD1D1.length, 0.1);

        assertEquals(0, waypointGraph.waypointNodeMap.get("D1").startToStopNeighbors.size());
        assertEquals(1, waypointGraph.waypointNodeMap.get("D1").stopToStartNeighbors.size());

        checkWaypointGraph(waypointGraph);
    }
}
