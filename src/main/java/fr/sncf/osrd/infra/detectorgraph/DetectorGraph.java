package fr.sncf.osrd.infra.detectorgraph;

import static fr.sncf.osrd.utils.graph.EdgeDirection.*;

import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.utils.graph.*;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.utils.CryoMap;
import fr.sncf.osrd.utils.PointValue;

import java.util.ArrayList;
import java.util.BitSet;
import java.util.List;

public final class DetectorGraph extends AbstractBiGraph<DetectorNode, TVDSectionPath> {

    public final CryoMap<String, DetectorNode> detectorNodeMap = new CryoMap<>();
    // TVDSectionPath are identified by the couple (StartNode, EndNode)
    public final CryoMap<TVDSectionPathID, TVDSectionPath> tvdSectionPathMap = new CryoMap<>();

    public static void markAsVisited(BitSet[] visitedEdgeDirs, TrackSection edge, EdgeDirection dir) {
        visitedEdgeDirs[dir.id].set(edge.index);
    }

    public static boolean wasVisitedInAnyDirection(BitSet[] visitedEdgeDirs, TrackSection edge) {
        var edgeIndex = edge.index;
        return visitedEdgeDirs[START_TO_STOP.id].get(edgeIndex) || visitedEdgeDirs[STOP_TO_START.id].get(edgeIndex);
    }

    /** Build a DetectorGraph given a TrackGraph */
    public static DetectorGraph buildDetectorGraph(TrackGraph trackGraph) {
        var graph = new DetectorGraph();

        // Create Detector nodes
        for (var trackSection : trackGraph.iterEdges())
            for (var detector : trackSection.detectors)
                graph.makeDetectorNode(detector.value.id);

        // create TVDSectionPaths that are begin and end on the same edge
        for (var trackSection : trackGraph.iterEdges()) {
            var detectorsCount = trackSection.detectors.size();
            for (int i = 1; i < detectorsCount; i++) {
                var lastDetector = trackSection.detectors.get(i - 1);
                var curDetector = trackSection.detectors.get(i);

                var lastNode = graph.findDetectorNode(lastDetector.value);
                var curNode = graph.findDetectorNode(curDetector.value);

                var length = curDetector.position - lastDetector.position;
                // Create TVDSectionPath
                graph.makeTVDSectionPath(lastNode, START_TO_STOP, curNode, STOP_TO_START, length);
            }
        }

        // Create list of visited trackSection
        var edgeCount = trackGraph.getEdgeCount();
        var visitedEdgeDirs = new BitSet[] {
                new BitSet(edgeCount), // START_TO_STOP
                new BitSet(edgeCount)  // STOP_TO_START
        };

        // Link detectorNodes
        for (var edge : trackGraph.iterEdges()) {
            if (wasVisitedInAnyDirection(visitedEdgeDirs, edge))
                continue;

            if (edge.detectors.size() == 0)
                continue;

            var lastDetector = getLastDetector(edge);
            markAsVisited(visitedEdgeDirs, edge, START_TO_STOP);
            graph.traverseTrackGraph(
                    edge, START_TO_STOP,
                    graph.findDetectorNode(lastDetector.value), START_TO_STOP,
                    edge.length - lastDetector.position,
                    visitedEdgeDirs
            );

            var firstDetector = getFirstDetector(edge);
            markAsVisited(visitedEdgeDirs, edge, STOP_TO_START);
            graph.traverseTrackGraph(
                    edge, STOP_TO_START,
                    graph.findDetectorNode(firstDetector.value), STOP_TO_START,
                    firstDetector.position,
                    visitedEdgeDirs
            );
        }
        return graph;
    }

    private static PointValue<Detector> getLastDetector(TrackSection edge) {
        var detectors = edge.detectors;
        return detectors.get(detectors.size() - 1);
    }

    private static PointValue<Detector> getFirstDetector(TrackSection edge) {
        return edge.detectors.get(0);
    }

    /**
     * Arriving onto trackSection with direction trackDirection, the last seen detector was sourceDetector, which is
     * tvdSectionPathLength away from the beginning of the trackSection. sourceDetectorDirection is the direction we
     * were traversing the sourceDetector's track section with.
     */
    private void linkDetectorsBetweenEdges(
            TrackSection trackSection,
            EdgeDirection trackDirection,
            DetectorNode sourceDetector,
            EdgeDirection sourceDetectorDirection,
            double tvdSectionPathLength,
            BitSet[] visitedEdgeDirs
    ) {
        // if the track section has no detectors, skip right over it
        if (trackSection.detectors.size() == 0) {
            traverseTrackGraph(
                    trackSection,
                    trackDirection,
                    sourceDetector,
                    sourceDetectorDirection,
                    tvdSectionPathLength + trackSection.length,
                    visitedEdgeDirs);
            return;
        }

        var firstEdgeDetector = getFirstDetector(trackSection);
        var lastEdgeDetector = getLastDetector(trackSection);
        var firstEdgeDetectorNode = findDetectorNode(firstEdgeDetector.value);
        var lastEdgeDetectorNode = findDetectorNode(lastEdgeDetector.value);
        final var firstDetectorNode = trackDirection == START_TO_STOP ? firstEdgeDetectorNode : lastEdgeDetectorNode;
        final var lastDetectorNode = trackDirection == START_TO_STOP ? lastEdgeDetectorNode : firstEdgeDetectorNode;

        // Check if the tvdSection not already handled
        if (containsTVDSectionPath(sourceDetector.index, firstDetectorNode.index))
            return;

        double startToFirstDetectorDist;
        double lastDetectorToEndDist;
        if (trackDirection == START_TO_STOP) {
            startToFirstDetectorDist = firstEdgeDetector.position;
            lastDetectorToEndDist = trackSection.length - lastEdgeDetector.position;
        } else {
            startToFirstDetectorDist = trackSection.length - lastEdgeDetector.position;
            lastDetectorToEndDist = firstEdgeDetector.position;
        }

        // Create TVDSectionPath between where we're coming and the first detector we run into
        makeTVDSectionPath(
                sourceDetector, sourceDetectorDirection, firstDetectorNode, trackDirection.opposite(),
                tvdSectionPathLength + startToFirstDetectorDist
        );

        // Backward traversal
        traverseTrackGraph(
                trackSection,
                trackDirection.opposite(),
                firstDetectorNode,
                trackDirection.opposite(),
                startToFirstDetectorDist,
                visitedEdgeDirs
        );

        // Continue traversal forward
        traverseTrackGraph(
                trackSection,
                trackDirection,
                lastDetectorNode,
                trackDirection,
                lastDetectorToEndDist,
                visitedEdgeDirs
        );
    }

    /**
     * Arriving from trackSection with direction trackDirection on it.
     * The last detector seen was sourceDetector, and the current distance to it is tvdSectionPathLength
     */
    private void traverseTrackGraph(
            TrackSection trackSection,
            EdgeDirection trackDirection,
            DetectorNode sourceDetector,
            EdgeDirection sourceDetectorDirection,
            double tvdSectionPathLength,
            BitSet[] visitedEdgeDirs
    ) {
        var endpoint = trackDirection == START_TO_STOP ? EdgeEndpoint.END : EdgeEndpoint.BEGIN;
        for (var neighbor: trackSection.getNeighbors(endpoint)) {
            // find the direction we're approaching the neighbor from
            var neighborDir = trackSection.getNeighborDirection(neighbor, trackSection.getEndNode(trackDirection));

            // if the neighbor was already visited from this direction, skip it
            if (visitedEdgeDirs[neighborDir.id].get(neighbor.index))
                continue;

            markAsVisited(visitedEdgeDirs, neighbor, neighborDir);

            linkDetectorsBetweenEdges(
                    neighbor, neighborDir,
                    sourceDetector, sourceDetectorDirection,
                    tvdSectionPathLength, visitedEdgeDirs
            );
        }
    }

    /**
     * Find a DetectorNode from a Detector
     *
     * @param detector the detector
     * @return the detector node
     */
    private DetectorNode findDetectorNode(Detector detector) {
        return this.detectorNodeMap.get(detector.id);
    }

    /**
     * Create a DetectorNode
     *
     * @param id the node identifier
     * @return the node
     */
    private DetectorNode makeDetectorNode(String id) {
        var node = new DetectorNode(this, nextNodeIndex());
        detectorNodeMap.put(id, node);
        return node;
    }

    /**
     * Create a DetectorNode
     *
     * @param startNode start detector node id
     * @param startNodeDirection the direction of the train when going to the endNode
     * @param endNode end detector node id
     * @param endNodeDirection the direction of the train when going to the startNode
     * @param length length of the SectionPath
     * @return the TVDSectionPath
     */
    private TVDSectionPath makeTVDSectionPath(
            DetectorNode startNode,
            EdgeDirection startNodeDirection,
            DetectorNode endNode,
            EdgeDirection endNodeDirection,
            double length
    ) {
        var startNodeIndex = startNode.index;
        var endNodeIndex = endNode.index;

        // create the path and register it with the graph
        var tvdSectionPath = new TVDSectionPath(
                this,
                startNodeIndex, startNodeDirection,
                endNodeIndex, endNodeDirection,
                length
        );

        // fill the tvdSectionPathMap
        var id = TVDSectionPathID.build(startNodeIndex, endNodeIndex);
        tvdSectionPathMap.put(id, tvdSectionPath);

        // fill the node adjacency lists
        startNode.getNeighbors(startNodeDirection).add(tvdSectionPath);
        endNode.getNeighbors(endNodeDirection).add(tvdSectionPath);
        return tvdSectionPath;
    }

    public TVDSectionPath getTVDSectionPath(int nodeA, int nodeB) {
        return tvdSectionPathMap.get(TVDSectionPathID.build(nodeA, nodeB));
    }

    private boolean containsTVDSectionPath(int nodeA, int nodeB) {
        return tvdSectionPathMap.containsKey(TVDSectionPathID.build(nodeA, nodeB));
    }

    @Override
    public List<TVDSectionPath> getNeighbors(
            TVDSectionPath edge,
            EdgeEndpoint endpoint
    ) {
        var nodeIndex = endpoint == EdgeEndpoint.BEGIN ? edge.startNode : edge.endNode;
        var node = getNode(nodeIndex);

        if (edge.nodeDirection(endpoint) == EdgeDirection.START_TO_STOP)
            return node.startToStopNeighbors;
        return node.stopToStartNeighbors;
    }
}
