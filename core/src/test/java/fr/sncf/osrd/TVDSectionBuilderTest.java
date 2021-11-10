package fr.sncf.osrd;

import static fr.sncf.osrd.infra.trackgraph.TrackSection.linkEdges;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import fr.sncf.osrd.infra.TvdSectionBuilder;
import fr.sncf.osrd.infra.trackgraph.BufferStop;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

public class TVDSectionBuilderTest {
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
        var d1 = new Detector(0, "D1");
        var d2 = new Detector(0, "D2");
        var d3 = new Detector(0, "D3");
        detectorBuilder.add(40, d1);
        detectorBuilder.add(50, d2);
        detectorBuilder.add(75, d3);
        detectorBuilder.build();

        // Build DetectorGraph
        var tvdSections = TvdSectionBuilder.build(trackGraph);
        assertEquals(2, tvdSections.size());

        assertNull(d1.beforeTvdSection);
        assert d1.afterTvdSection == d2.beforeTvdSection;
        assert d2.afterTvdSection == d3.beforeTvdSection;
        assertNull(d3.afterTvdSection);
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
        // region BUILD_INFRA
        // Craft trackGraph
        var trackGraph = new TrackGraph();
        var nodeA = trackGraph.makePlaceholderNode("A");
        var nodeB = trackGraph.makePlaceholderNode("B");
        var nodeC = trackGraph.makePlaceholderNode("C");
        var nodeD = trackGraph.makePlaceholderNode("D");

        // forward
        var fooA = trackGraph.makeTrackSection(nodeA.index, nodeC.index, "foo_a", 100, null);
        var detectorsFooA = fooA.waypoints.builder();
        var d1 = new Detector(0, "D1");
        detectorsFooA.add(75, d1);
        var bs1 = new BufferStop(1, "BS_1");
        detectorsFooA.add(0, bs1);
        detectorsFooA.build();

        // forward
        var fooB = trackGraph.makeTrackSection(nodeB.index, nodeC.index, "foo_b", 100, null);
        var detectorsFooB = fooB.waypoints.builder();
        var d2 = new Detector(2, "D2");
        detectorsFooB.add(50, d2);
        var bs2 = new BufferStop(3, "BS_2");
        detectorsFooB.add(0, bs2);
        detectorsFooB.build();

        // backward
        var track = trackGraph.makeTrackSection(nodeD.index, nodeC.index, "track", 500, null);
        var detectorsTrack = track.waypoints.builder();
        var d4 = new Detector(4, "D4");
        detectorsTrack.add(50, d4);
        var d3 = new Detector(5, "D3");
        detectorsTrack.add(450, d3);
        var bs3 = new BufferStop(6, "BS_3");
        detectorsTrack.add(0, bs3);
        detectorsTrack.build();

        linkEdges(fooA, EdgeEndpoint.END, track, EdgeEndpoint.END);
        linkEdges(fooB, EdgeEndpoint.END, track, EdgeEndpoint.END);
        // endregion

        var tvdSections = TvdSectionBuilder.build(trackGraph);

        assertEquals(5, tvdSections.size());
        assertNull(bs1.beforeTvdSection);
        assert bs1.afterTvdSection == d1.beforeTvdSection;
        assertNull(bs2.beforeTvdSection);
        assert bs2.afterTvdSection == d2.beforeTvdSection;
        assert d1.afterTvdSection == d3.afterTvdSection;
        assert d2.afterTvdSection == d3.afterTvdSection;
        assert d3.beforeTvdSection == d4.afterTvdSection;
        assert d4.beforeTvdSection == bs3.afterTvdSection;
        assertNull(bs3.beforeTvdSection);
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
        var d1 = new Detector(0, "D1");
        detectorsAB.add(50, d1);
        detectorsAB.build();

        var trackBC = trackGraph.makeTrackSection(nodeB.index, nodeC.index, "track_b_c", 100, null);
        var detectorsBC = trackBC.waypoints.builder();
        var d2 = new Detector(1, "D2");
        detectorsBC.add(50, d2);
        detectorsBC.build();

        var trackCA = trackGraph.makeTrackSection(nodeC.index, nodeA.index, "track_c_a", 100, null);
        var detectorsCA = trackCA.waypoints.builder();
        var d3 = new Detector(2, "D3");
        detectorsCA.add(50, d3);
        detectorsCA.build();

        linkEdges(trackAB, EdgeEndpoint.END, trackBC, EdgeEndpoint.BEGIN);
        linkEdges(trackBC, EdgeEndpoint.END, trackCA, EdgeEndpoint.BEGIN);
        linkEdges(trackCA, EdgeEndpoint.END, trackAB, EdgeEndpoint.BEGIN);

        // Check tvd sections
        var tvdSections = TvdSectionBuilder.build(trackGraph);
        assertEquals(3, tvdSections.size());

        assert d1.afterTvdSection == d2.beforeTvdSection;
        assert d2.afterTvdSection == d3.beforeTvdSection;
        assert d3.afterTvdSection == d1.beforeTvdSection;
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
        var d1 = new Detector(0, "D1");
        detectorsAB.add(50, d1);
        detectorsAB.build();

        // Check tvd sections
        var tvdSections = TvdSectionBuilder.build(trackGraph);
        assertEquals(0, tvdSections.size());
        assertNull(d1.afterTvdSection);
        assertNull(d1.beforeTvdSection);
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
        var d1 = new Detector(0, "D1");
        detectorsCD.add(10, d1);
        var bs1 = new BufferStop(1, "BS1");
        detectorsCD.add(0, bs1);
        detectorsCD.build();

        // Check tvd sections
        var tvdSections = TvdSectionBuilder.build(trackGraph);
        assertEquals(1, tvdSections.size());
        assert bs1.afterTvdSection == d1.beforeTvdSection;
        assertNull(bs1.beforeTvdSection);
        assertNull(d1.afterTvdSection);
    }
}
