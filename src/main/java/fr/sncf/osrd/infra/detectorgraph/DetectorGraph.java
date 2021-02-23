package fr.sncf.osrd.infra.detectorgraph;

import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.infra.graph.EdgeEndpoint;
import fr.sncf.osrd.infra.graph.Graph;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.util.CryoMap;
import fr.sncf.osrd.util.PointValue;
import javafx.util.Pair;

import java.util.Collection;
import java.util.HashSet;
import java.util.Iterator;

public final class DetectorGraph extends Graph<DetectorNode, TVDSectionPath> {

    public final CryoMap<ID<Detector>, DetectorNode> detectorNodeMap = new CryoMap<>();
    // TVDSectionPath are identified by the couple (StartNode, EndNode)
    private final CryoMap<Pair<Integer, Integer>, TVDSectionPath> tvdSectionPathMap = new CryoMap<>();

    /**
     * Build a DetectorGraph given a TrackGraph
     */
    public DetectorGraph(TrackGraph trackGraph) {
        // Create Detector nodes
        for (var trackSection : trackGraph.edges) {
            for (var detector : trackSection.detectors) {
                makeDetectorNode(detector.value);
            }
        }

        // Create list of processed trackSection
        var processedTrackSection = new HashSet<String>();
        var visitedTrackSection = new HashSet<Pair<String, EdgeDirection>>();

        // Link detectorNodes
        for (var trackSection : trackGraph.edges) {
            var iterDetectors = trackSection.detectors.iterator();
            if (!processedTrackSection.contains(trackSection.id) && iterDetectors.hasNext()) {
                processTrackSection(trackSection, processedTrackSection);
                var extremityDetectors = extremityDetectors(iterDetectors);

                visitedTrackSection.add(new Pair<>(trackSection.id, EdgeDirection.START_TO_STOP));
                var linkDetector = findDetectorNode(extremityDetectors.getValue().value);
                var distance = trackSection.length - extremityDetectors.getValue().position;
                traverseTrackGraph(trackSection, EdgeDirection.START_TO_STOP, linkDetector, distance,
                        processedTrackSection, visitedTrackSection);

                visitedTrackSection.add(new Pair<>(trackSection.id, EdgeDirection.STOP_TO_START));
                linkDetector = findDetectorNode(extremityDetectors.getKey().value);
                distance = extremityDetectors.getKey().position;
                traverseTrackGraph(trackSection, EdgeDirection.STOP_TO_START, linkDetector, distance,
                        processedTrackSection, visitedTrackSection);
            }
        }
    }

    private void buildGraph(
            TrackSection trackSection,
            EdgeDirection direction,
            DetectorNode linkDetector,
            EdgeDirection linkDetectorDirection,
            double distance,
            HashSet<String> processedTrackSection,
            HashSet<Pair<String, EdgeDirection>> visitedTrackSection
    ) {
        processTrackSection(trackSection, processedTrackSection);

        var iter = trackSection.detectors.iterator();
        if (iter.hasNext()) {
            var extremityDetectors = extremityDetectors(iter);
            var firstDetector = findDetectorNode(extremityDetectors.getKey().value);
            var lastDetector = findDetectorNode(extremityDetectors.getValue().value);
            if (direction == EdgeDirection.START_TO_STOP) {
                // Check if the tvdSection not already handled
                if (containsTVDSectionPath(linkDetector.getIndex(), firstDetector.getIndex()))
                    return;
                // Create TVDSectionPath
                distance += extremityDetectors.getKey().position;
                var tvdSectionPath = makeTVDSectionPath(linkDetector.getIndex(), firstDetector.getIndex(), distance,
                        linkDetectorDirection, direction);
                firstDetector.stopToStartNeighbors.add(tvdSectionPath);
                if (linkDetectorDirection == EdgeDirection.START_TO_STOP)
                    linkDetector.stopToStartNeighbors.add(tvdSectionPath);
                else
                    linkDetector.startToStopNeighbors.add(tvdSectionPath);

                // Backward traversal
                distance = extremityDetectors.getKey().position;
                traverseTrackGraph(trackSection, EdgeDirection.STOP_TO_START, firstDetector, distance,
                        processedTrackSection, visitedTrackSection);

                // Preparing for the continuation of the forward traversal
                linkDetector = lastDetector;
                distance = trackSection.length - extremityDetectors.getValue().position;
            } else {
                // Check if the tvdSection not already handled
                if (containsTVDSectionPath(linkDetector.getIndex(), lastDetector.getIndex()))
                    return;
                // Create TVDSectionPath
                distance += trackSection.length - extremityDetectors.getValue().position;
                var tvdSectionPath = makeTVDSectionPath(linkDetector.getIndex(), lastDetector.getIndex(), distance,
                        linkDetectorDirection, direction);
                lastDetector.startToStopNeighbors.add(tvdSectionPath);
                if (linkDetectorDirection == EdgeDirection.START_TO_STOP)
                    linkDetector.stopToStartNeighbors.add(tvdSectionPath);
                else
                    linkDetector.startToStopNeighbors.add(tvdSectionPath);

                // Backward traversal
                distance = trackSection.length - extremityDetectors.getValue().position;
                traverseTrackGraph(trackSection, EdgeDirection.START_TO_STOP, lastDetector, distance,
                        processedTrackSection, visitedTrackSection);

                // Preparing for the continuation of the forward traversal
                linkDetector = firstDetector;
                distance = extremityDetectors.getKey().position;
            }
        } else {
            distance += trackSection.length;
        }

        // Continue traversal forward
        traverseTrackGraph(trackSection, direction, linkDetector, distance, processedTrackSection, visitedTrackSection);
    }

    private void traverseTrackGraph(
            TrackSection trackSection,
            EdgeDirection direction,
            DetectorNode linkDetector,
            double distance,
            HashSet<String> processedTrackSection,
            HashSet<Pair<String, EdgeDirection>> visitedTrackSection
    ) {
        var endpoint = direction == EdgeDirection.START_TO_STOP ? EdgeEndpoint.END : EdgeEndpoint.BEGIN;
        for (var nextTrackSection: trackSection.getNeighbors(endpoint)) {
            var nextTrackDirection =
                    trackSection.getNeighborDirection(nextTrackSection, trackSection.getEndNode(direction));
            var visitedKey = new Pair<>(nextTrackSection.id, nextTrackDirection);
            if (!visitedTrackSection.contains(visitedKey)) {
                visitedTrackSection.add(visitedKey);
                buildGraph(nextTrackSection, nextTrackDirection, linkDetector, direction.opposite(), distance,
                        processedTrackSection, visitedTrackSection);
            }
        }

    }

    private Pair<PointValue<Detector>, PointValue<Detector>> extremityDetectors(Iterator<PointValue<Detector>> iter) {
        var firstDetector = iter.next();
        var lastDetector = firstDetector;
        // TODO: Change PointSequence to easily retrieve last detector
        while (iter.hasNext())
            lastDetector = iter.next();
        return new Pair<>(firstDetector, lastDetector);
    }

    /**
     * Create tvdSectionPath between detectors on the same trackSection and link nodes to them.
     * Important: This function has to be call once by trackSection.
     * Note: This function doesn't do anything if the given trackSection has less than 2 detectors on it.
     * @param trackSection to process
     */
    private void processTrackSection(TrackSection trackSection, HashSet<String> processedTrackSection) {
        // Check trackSection not already processed
        if (processedTrackSection.contains(trackSection.id))
            return;

        // Mark the trackSection has processed
        processedTrackSection.add(trackSection.id);

        var iter = trackSection.detectors.iterator();
        // Check trackSection has detectors
        if (!iter.hasNext())
            return;

        var lastDetector = iter.next();
        while (iter.hasNext()) {
            var lastNode = findDetectorNode(lastDetector.value);
            var curDetector = iter.next();
            var curNode = findDetectorNode(curDetector.value);
            var length = curDetector.position - lastDetector.position;
            // Create TVDSectionPath
            var tvdSectionPath = makeTVDSectionPath(lastNode.getIndex(), curNode.getIndex(), length,
                    EdgeDirection.STOP_TO_START, EdgeDirection.START_TO_STOP);
            // Link nodes to the TVDSectionPath
            lastNode.startToStopNeighbors.add(tvdSectionPath);
            curNode.stopToStartNeighbors.add(tvdSectionPath);
            lastDetector = curDetector;
        }
    }

    /**
     * Find a DetectorNode from a Detector
     *
     * @param detector the detector
     * @return the detector node
     */
    private DetectorNode findDetectorNode(Detector detector) {
        return this.detectorNodeMap.get(ID.from(detector));
    }

    /**
     * Create a DetectorNode
     *
     * @param detector linked to the node
     * @return the node
     */
    private DetectorNode makeDetectorNode(Detector detector) {
        var node = new DetectorNode();
        this.register(node);
        detectorNodeMap.put(ID.from(detector), node);
        return node;
    }

    /**
     * Create a DetectorNode
     *
     * @param startNode start detector node id
     * @param endNode end detector node id
     * @param length length of the SectionPath
     * @param startNodeDirection the direction of the train when going to the startNode
     * @param endNodeDirection the direction of the train when going to the endNode
     * @return the TVDSectionPath
     */
    private TVDSectionPath makeTVDSectionPath(
            int startNode,
            int endNode,
            double length,
            EdgeDirection startNodeDirection,
            EdgeDirection endNodeDirection
    ) {
        // Assure order in the tvdSectionPath id key
        if (startNode > endNode) {
            return makeTVDSectionPath(endNode, startNode, length, endNodeDirection, startNodeDirection);
        }
        var tvdSectionPath = new TVDSectionPath(startNode, endNode, length, startNodeDirection, endNodeDirection);
        this.register(tvdSectionPath);
        var id = new Pair<>(startNode, endNode);
        tvdSectionPathMap.put(id, tvdSectionPath);
        return tvdSectionPath;
    }

    private Pair<Integer, Integer>  makeTVDSectionPathKey(int nodeA, int nodeB) {
        if (nodeA < nodeB)
            return new Pair<>(nodeA, nodeB);
        return new Pair<>(nodeB, nodeA);
    }

    public TVDSectionPath getTVDSectionPath(int nodeA, int nodeB) {
        return tvdSectionPathMap.get(makeTVDSectionPathKey(nodeA, nodeB));
    }

    public boolean containsTVDSectionPath(int nodeA, int nodeB) {
        return tvdSectionPathMap.containsKey(makeTVDSectionPathKey(nodeA, nodeB));
    }

    public Collection<TVDSectionPath> getTVDSectionPathCollection() {
        return tvdSectionPathMap.values();
    }
}
