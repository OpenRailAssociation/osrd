package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static fr.sncf.osrd.infra.trackgraph.TrackSection.linkEdges;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.detectorgraph.DetectorGraph;
import fr.sncf.osrd.infra.graph.EdgeEndpoint;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import org.junit.jupiter.api.Test;

public class DetectorGraphTest {
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
        var trackSection = trackGraph.makeTrackSection(nodeA.getIndex(), nodeB.getIndex(), "e1", 100);
        var detectorBuilder = trackSection.detectors.builder();
        detectorBuilder.add(40, new Detector("D1"));
        detectorBuilder.add(50, new Detector("D2"));
        detectorBuilder.add(75, new Detector("D3"));
        detectorBuilder.build();

        // Build DetectorGraph
        var detectorGraph = new DetectorGraph(trackGraph);

        // Check Detector Graph
        assertEquals(3, detectorGraph.detectorNodeMap.size());
        assertEquals(2, detectorGraph.getTVDSectionPathCollection().size());

        var tvdSectionD1D2 = detectorGraph.getTVDSectionPath(0, 1);
        var tvdSectionD2D3 = detectorGraph.getTVDSectionPath(1, 2);
        assertEquals(10, tvdSectionD1D2.length, 0.1);
        assertEquals(25, tvdSectionD2D3.length, 0.1);

        assertEquals(1, detectorGraph.detectorNodeMap.get(new ID<Detector>("D1")).startToStopNeighbors.size());
        assertEquals(0, detectorGraph.detectorNodeMap.get(new ID<Detector>("D1")).stopToStartNeighbors.size());
        assertEquals(1, detectorGraph.detectorNodeMap.get(new ID<Detector>("D2")).startToStopNeighbors.size());
        assertEquals(1, detectorGraph.detectorNodeMap.get(new ID<Detector>("D2")).stopToStartNeighbors.size());
        assertEquals(0, detectorGraph.detectorNodeMap.get(new ID<Detector>("D3")).startToStopNeighbors.size());
        assertEquals(1, detectorGraph.detectorNodeMap.get(new ID<Detector>("D3")).stopToStartNeighbors.size());
    }

    /**
     * Complex track graph.
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

        var fooA = trackGraph.makeTrackSection(nodeA.getIndex(), nodeC.getIndex(), "foo_a", 100);
        var detectorsFooA = fooA.detectors.builder();
        detectorsFooA.add(75, new Detector("D1"));
        detectorsFooA.build();

        var fooB = trackGraph.makeTrackSection(nodeB.getIndex(), nodeC.getIndex(), "foo_b", 100);
        var detectorsFooB = fooB.detectors.builder();
        detectorsFooB.add(50, new Detector("D2"));
        detectorsFooB.build();

        var track = trackGraph.makeTrackSection(nodeC.getIndex(), nodeD.getIndex(), "track", 500);
        var detectorsTrack = track.detectors.builder();
        detectorsTrack.add(50, new Detector("D3"));
        detectorsTrack.add(450, new Detector("D4"));
        detectorsTrack.build();

        linkEdges(fooA, EdgeEndpoint.END, track, EdgeEndpoint.BEGIN);
        linkEdges(fooB, EdgeEndpoint.END, track, EdgeEndpoint.BEGIN);

        // Build DetectorGraph
        var detectorGraph = new DetectorGraph(trackGraph);

        // Check Detector Graph
        assertEquals(4, detectorGraph.detectorNodeMap.size());
        assertEquals(3, detectorGraph.getTVDSectionPathCollection().size());

        var tvdSectionD1D3 = detectorGraph.getTVDSectionPath(0, 2);
        var tvdSectionD2D3 = detectorGraph.getTVDSectionPath(1, 2);
        var tvdSectionD3D4 = detectorGraph.getTVDSectionPath(2, 3);
        assertEquals(75, tvdSectionD1D3.length, 0.1);
        assertEquals(100, tvdSectionD2D3.length, 0.1);
        assertEquals(400, tvdSectionD3D4.length, 0.1);

        assertEquals(1, detectorGraph.detectorNodeMap.get(new ID<Detector>("D1")).startToStopNeighbors.size());
        assertEquals(0, detectorGraph.detectorNodeMap.get(new ID<Detector>("D1")).stopToStartNeighbors.size());
        assertEquals(1, detectorGraph.detectorNodeMap.get(new ID<Detector>("D2")).startToStopNeighbors.size());
        assertEquals(0, detectorGraph.detectorNodeMap.get(new ID<Detector>("D2")).stopToStartNeighbors.size());
        assertEquals(1, detectorGraph.detectorNodeMap.get(new ID<Detector>("D3")).startToStopNeighbors.size());
        assertEquals(2, detectorGraph.detectorNodeMap.get(new ID<Detector>("D3")).stopToStartNeighbors.size());
        assertEquals(0, detectorGraph.detectorNodeMap.get(new ID<Detector>("D4")).startToStopNeighbors.size());
        assertEquals(1, detectorGraph.detectorNodeMap.get(new ID<Detector>("D4")).stopToStartNeighbors.size());

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

        var trackAB = trackGraph.makeTrackSection(nodeA.getIndex(), nodeB.getIndex(), "track_a_b", 100);
        var detectorsAB = trackAB.detectors.builder();
        detectorsAB.add(50, new Detector("D1"));
        detectorsAB.build();

        var trackBC = trackGraph.makeTrackSection(nodeB.getIndex(), nodeC.getIndex(), "track_b_c", 100);
        var detectorsBC = trackBC.detectors.builder();
        detectorsBC.add(50, new Detector("D2"));
        detectorsBC.build();

        var trackCA = trackGraph.makeTrackSection(nodeC.getIndex(), nodeA.getIndex(), "track_c_a", 100);
        var detectorsCA = trackCA.detectors.builder();
        detectorsCA.add(50, new Detector("D3"));
        detectorsCA.build();

        linkEdges(trackAB, EdgeEndpoint.END, trackBC, EdgeEndpoint.BEGIN);
        linkEdges(trackBC, EdgeEndpoint.END, trackCA, EdgeEndpoint.BEGIN);
        linkEdges(trackCA, EdgeEndpoint.END, trackAB, EdgeEndpoint.BEGIN);

        // Build DetectorGraph
        var detectorGraph = new DetectorGraph(trackGraph);

        // Check Detector Graph
        assertEquals(3, detectorGraph.detectorNodeMap.size());
        assertEquals(3, detectorGraph.getTVDSectionPathCollection().size());

        var tvdSectionD1D2 = detectorGraph.getTVDSectionPath(0, 1);
        var tvdSectionD2D3 = detectorGraph.getTVDSectionPath(1, 2);
        var tvdSectionD3D1 = detectorGraph.getTVDSectionPath(2, 0);
        assertEquals(100, tvdSectionD1D2.length, 0.1);
        assertEquals(100, tvdSectionD2D3.length, 0.1);
        assertEquals(100, tvdSectionD3D1.length, 0.1);

        assertEquals(1, detectorGraph.detectorNodeMap.get(new ID<Detector>("D1")).startToStopNeighbors.size());
        assertEquals(1, detectorGraph.detectorNodeMap.get(new ID<Detector>("D1")).stopToStartNeighbors.size());
        assertEquals(1, detectorGraph.detectorNodeMap.get(new ID<Detector>("D2")).startToStopNeighbors.size());
        assertEquals(1, detectorGraph.detectorNodeMap.get(new ID<Detector>("D2")).stopToStartNeighbors.size());
        assertEquals(1, detectorGraph.detectorNodeMap.get(new ID<Detector>("D3")).startToStopNeighbors.size());
        assertEquals(1, detectorGraph.detectorNodeMap.get(new ID<Detector>("D3")).stopToStartNeighbors.size());

    }
}
