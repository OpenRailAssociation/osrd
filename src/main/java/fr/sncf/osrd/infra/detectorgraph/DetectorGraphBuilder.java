package fr.sncf.osrd.infra.detectorgraph;

import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.utils.PointValue;
import fr.sncf.osrd.utils.graph.BiGraphOverlayBuilder;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.List;

public final class DetectorGraphBuilder extends BiGraphOverlayBuilder<
        Waypoint,
        TrackSection,
        TrackGraph,
        DetectorNode,
        TVDSectionPath,
        DetectorGraph
        > {
    public DetectorGraphBuilder(TrackGraph baseGraph, DetectorGraph overlayGraph) {
        super(overlayGraph.tvdSectionPathMap, baseGraph, overlayGraph);
    }

    @Override
    protected List<PointValue<Waypoint>> getBridgeObjects(TrackSection edge) {
        return edge.waypoints.data;
    }

    @Override
    protected DetectorNode makeOverlayNode(Waypoint bridgeObject) {
        var node = new DetectorNode(overlayGraph, overlayGraph.nextNodeIndex());
        overlayGraph.detectorNodeMap.put(bridgeObject.id, node);
        return node;
    }

    @Override
    protected TVDSectionPath linkOverlayNodes(
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
                overlayGraph,
                startNodeIndex, startNodeDirection,
                endNodeIndex, endNodeDirection,
                length
        );

        // fill the node adjacency lists
        startNode.getNeighbors(startNodeDirection).add(tvdSectionPath);
        endNode.getNeighbors(endNodeDirection).add(tvdSectionPath);
        return tvdSectionPath;
    }
}
