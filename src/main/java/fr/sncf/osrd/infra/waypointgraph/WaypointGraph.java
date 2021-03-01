package fr.sncf.osrd.infra.waypointgraph;

import static fr.sncf.osrd.utils.graph.EdgeDirection.*;

import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.utils.graph.*;
import fr.sncf.osrd.utils.CryoMap;

import java.util.List;

public final class WaypointGraph extends BiNGraph<TVDSectionPath, WaypointNode> {
    public final CryoMap<String, WaypointNode> waypointNodeMap = new CryoMap<>();
    // TVDSectionPath are identified by the couple (StartNode, EndNode)
    public final CryoMap<UndirectedBiEdgeID, TVDSectionPath> tvdSectionPathMap = new CryoMap<>();

    /** Automatically create a detector graph from a track graph */
    public static WaypointGraph buildDetectorGraph(TrackGraph trackGraph) {
        var detectorGraph = new WaypointGraph();
        var builder = new WaypointGraphBuilder(trackGraph, detectorGraph);
        builder.build();
        return detectorGraph;
    }

    @Override
    public List<TVDSectionPath> getNeighbors(
            TVDSectionPath edge,
            EdgeEndpoint endpoint
    ) {
        var nodeIndex = endpoint == EdgeEndpoint.BEGIN ? edge.startNode : edge.endNode;
        var node = getNode(nodeIndex);

        if (edge.nodeDirection(endpoint) == START_TO_STOP)
            return node.startToStopNeighbors;
        return node.stopToStartNeighbors;
    }

    public TVDSectionPath getTVDSectionPath(int startNode, int endNode) {
        return tvdSectionPathMap.get(UndirectedBiEdgeID.from(startNode, endNode));
    }
}
