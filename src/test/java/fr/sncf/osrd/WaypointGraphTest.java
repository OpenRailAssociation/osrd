package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static fr.sncf.osrd.infra.trackgraph.TrackSection.linkEdges;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.waypointgraph.WaypointGraph;
import fr.sncf.osrd.infra.trackgraph.BufferStop;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import org.junit.jupiter.api.Test;

import java.util.TreeMap;

public class WaypointGraphTest {
    /**
     * One tiv with 3 detectors on it.
     * A                  B
     * |---D1---D2---D3---|
     */
    @Test
    public void simpleDetectorGraphBuild() throws InvalidInfraException {
        // Craft trackGraph
        var trackGraph = new TrackGraph();
        var nodeA = trackGraph.makePlaceholderNode("A");
        var nodeB = trackGraph.makePlaceholderNode("B");
        var trackSection = trackGraph.makeTrackSection(nodeA.index, nodeB.index, "e1", 100);
        var detectorBuilder = trackSection.waypoints.builder();
        detectorBuilder.add(40, new Detector("D1"));
        detectorBuilder.add(50, new Detector("D2"));
        detectorBuilder.add(75, new Detector("D3"));
        detectorBuilder.build();

        // Build DetectorGraph
        var detectorGraph = WaypointGraph.buildDetectorGraph(trackGraph);

        // Check Detector Graph
        assertEquals(3, detectorGraph.waypointNodeMap.size());
        assertEquals(2, detectorGraph.tvdSectionPathMap.size());

        var tvdSectionD1D2 = detectorGraph.getTVDSectionPath(0, 1);
        var tvdSectionD2D3 = detectorGraph.getTVDSectionPath(1, 2);
        assertEquals(10, tvdSectionD1D2.length, 0.1);
        assertEquals(25, tvdSectionD2D3.length, 0.1);

        assertEquals(1, detectorGraph.waypointNodeMap.get("D1").startToStopNeighbors.size());
        assertEquals(0, detectorGraph.waypointNodeMap.get("D1").stopToStartNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("D2").startToStopNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("D2").stopToStartNeighbors.size());
        assertEquals(0, detectorGraph.waypointNodeMap.get("D3").startToStopNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("D3").stopToStartNeighbors.size());
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
    public void complexDetectorGraphBuild() throws InvalidInfraException {
        // Craft trackGraph
        var trackGraph = new TrackGraph();
        var nodeA = trackGraph.makePlaceholderNode("A");
        var nodeB = trackGraph.makePlaceholderNode("B");
        var nodeC = trackGraph.makePlaceholderNode("C");
        var nodeD = trackGraph.makePlaceholderNode("D");

        // forward
        var fooA = trackGraph.makeTrackSection(nodeA.index, nodeC.index, "foo_a", 100);
        var detectorsFooA = fooA.waypoints.builder();
        detectorsFooA.add(75, new Detector("D1"));
        detectorsFooA.add(0, new BufferStop("BS_1"));
        detectorsFooA.build();

        // forward
        var fooB = trackGraph.makeTrackSection(nodeB.index, nodeC.index, "foo_b", 100);
        var detectorsFooB = fooB.waypoints.builder();
        detectorsFooB.add(50, new Detector("D2"));
        detectorsFooB.add(0, new BufferStop("BS_2"));
        detectorsFooB.build();

        // backward
        var track = trackGraph.makeTrackSection(nodeD.index, nodeC.index, "track", 500);
        var detectorsTrack = track.waypoints.builder();
        detectorsTrack.add(50, new Detector("D4"));
        detectorsTrack.add(450, new Detector("D3"));
        detectorsTrack.add(0, new BufferStop("BS_3"));
        detectorsTrack.build();

        linkEdges(fooA, EdgeEndpoint.END, track, EdgeEndpoint.END);
        linkEdges(fooB, EdgeEndpoint.END, track, EdgeEndpoint.END);

        // Build DetectorGraph
        var detectorGraph = WaypointGraph.buildDetectorGraph(trackGraph);

        // Check Detector Graph
        assertEquals(7, detectorGraph.waypointNodeMap.size());
        assertEquals(6, detectorGraph.tvdSectionPathMap.size());

        var waypointsIDMap = new TreeMap<String, Integer>();

        for (int i = 1; i <= 4; i++) {
            var strI = String.format("D%d", i);
            waypointsIDMap.put(strI, detectorGraph.waypointNodeMap.get(strI).index);
        }
        for (int i = 1; i <= 3; i++) {
            var strI = String.format("BS_%d", i);
            waypointsIDMap.put(strI, detectorGraph.waypointNodeMap.get(strI).index);
        }

        var tvdSectionD1D3 = detectorGraph.getTVDSectionPath(waypointsIDMap.get("D1"), waypointsIDMap.get("D3"));
        var tvdSectionD2D3 = detectorGraph.getTVDSectionPath(waypointsIDMap.get("D2"), waypointsIDMap.get("D3"));
        var tvdSectionD3D4 = detectorGraph.getTVDSectionPath(waypointsIDMap.get("D3"), waypointsIDMap.get("D4"));
        assertEquals(75, tvdSectionD1D3.length, 0.1);
        assertEquals(100, tvdSectionD2D3.length, 0.1);
        assertEquals(400, tvdSectionD3D4.length, 0.1);

        assertEquals(1, detectorGraph.waypointNodeMap.get("D1").startToStopNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("D1").stopToStartNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("D2").startToStopNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("D2").stopToStartNeighbors.size());
        assertEquals(2, detectorGraph.waypointNodeMap.get("D3").startToStopNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("D3").stopToStartNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("D4").startToStopNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("D4").stopToStartNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("BS_1").startToStopNeighbors.size());
        assertEquals(0, detectorGraph.waypointNodeMap.get("BS_1").stopToStartNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("BS_2").startToStopNeighbors.size());
        assertEquals(0, detectorGraph.waypointNodeMap.get("BS_2").stopToStartNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("BS_3").startToStopNeighbors.size());
        assertEquals(0, detectorGraph.waypointNodeMap.get("BS_3").stopToStartNeighbors.size());
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
    public void circularDetectorGraphBuild() throws InvalidInfraException {
        // Craft trackGraph
        var trackGraph = new TrackGraph();
        var nodeA = trackGraph.makePlaceholderNode("A");
        var nodeB = trackGraph.makePlaceholderNode("B");
        var nodeC = trackGraph.makePlaceholderNode("C");

        var trackAB = trackGraph.makeTrackSection(nodeA.index, nodeB.index, "track_a_b", 100);
        var detectorsAB = trackAB.waypoints.builder();
        detectorsAB.add(50, new Detector("D1"));
        detectorsAB.build();

        var trackBC = trackGraph.makeTrackSection(nodeB.index, nodeC.index, "track_b_c", 100);
        var detectorsBC = trackBC.waypoints.builder();
        detectorsBC.add(50, new Detector("D2"));
        detectorsBC.build();

        var trackCA = trackGraph.makeTrackSection(nodeC.index, nodeA.index, "track_c_a", 100);
        var detectorsCA = trackCA.waypoints.builder();
        detectorsCA.add(50, new Detector("D3"));
        detectorsCA.build();

        linkEdges(trackAB, EdgeEndpoint.END, trackBC, EdgeEndpoint.BEGIN);
        linkEdges(trackBC, EdgeEndpoint.END, trackCA, EdgeEndpoint.BEGIN);
        linkEdges(trackCA, EdgeEndpoint.END, trackAB, EdgeEndpoint.BEGIN);

        // Build DetectorGraph
        var detectorGraph = WaypointGraph.buildDetectorGraph(trackGraph);

        // Check Detector Graph
        assertEquals(3, detectorGraph.waypointNodeMap.size());
        assertEquals(3, detectorGraph.tvdSectionPathMap.size());

        var tvdSectionD1D2 = detectorGraph.getTVDSectionPath(0, 1);
        var tvdSectionD2D3 = detectorGraph.getTVDSectionPath(1, 2);
        var tvdSectionD3D1 = detectorGraph.getTVDSectionPath(2, 0);
        assertEquals(100, tvdSectionD1D2.length, 0.1);
        assertEquals(100, tvdSectionD2D3.length, 0.1);
        assertEquals(100, tvdSectionD3D1.length, 0.1);

        assertEquals(1, detectorGraph.waypointNodeMap.get("D1").startToStopNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("D1").stopToStartNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("D2").startToStopNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("D2").stopToStartNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("D3").startToStopNeighbors.size());
        assertEquals(1, detectorGraph.waypointNodeMap.get("D3").stopToStartNeighbors.size());

    }
}
