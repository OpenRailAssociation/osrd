package fr.sncf.osrd.infra.waypointgraph;

import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.utils.PointValue;
import fr.sncf.osrd.utils.graph.BiGraphOverlayBuilder;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.List;

public final class WaypointGraphBuilder extends BiGraphOverlayBuilder<
        Waypoint,
        TrackSection,
        TrackGraph,
        WaypointNode,
        TVDSectionPath,
        WaypointGraph
        > {
    public WaypointGraphBuilder(TrackGraph baseGraph, WaypointGraph overlayGraph) {
        super(overlayGraph.tvdSectionPathMap, baseGraph, overlayGraph);
    }

    @Override
    protected List<PointValue<Waypoint>> getBridgeObjects(TrackSection edge) {
        return edge.waypoints.data;
    }

    @Override
    protected WaypointNode makeOverlayNode(Waypoint bridgeObject) {
        var node = new WaypointNode(overlayGraph, overlayGraph.nextNodeIndex());
        overlayGraph.waypointNodeMap.put(bridgeObject.id, node);
        return node;
    }

    @Override
    protected TVDSectionPath linkOverlayNodes(
            WaypointNode startNode,
            EdgeDirection startNodeDirection,
            WaypointNode endNode,
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
