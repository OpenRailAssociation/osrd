package fr.sncf.osrd.infra.waypointgraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.PointValue;
import fr.sncf.osrd.utils.graph.UndirectedBiEdgeID;
import fr.sncf.osrd.utils.graph.overlay.BiGraphOverlayBuilder;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.overlay.OverlayPathEnd;
import fr.sncf.osrd.utils.graph.path.FullPathArray;

import java.util.ArrayList;
import java.util.List;

public final class WaypointGraphBuilder extends BiGraphOverlayBuilder<
        Waypoint,
        TrackSection,
        TrackGraph,
        Waypoint,
        TVDSectionPath,
        WaypointGraph
        > {
    public WaypointGraphBuilder(TrackGraph baseGraph, WaypointGraph overlayGraph) {
        super(baseGraph, overlayGraph, false);
    }

    @Override
    protected List<PointValue<Waypoint>> getBridgeObjects(TrackSection edge) {
        return edge.waypoints.data;
    }

    @Override
    protected Waypoint makeOverlayNode(Waypoint waypoint) {
        overlayGraph.resizeNodes(waypoint.index);
        overlayGraph.registerNode(waypoint);
        overlayGraph.waypointNodeMap.put(waypoint.id, waypoint);
        return waypoint;
    }

    @Override
    @SuppressFBWarnings(value = {"BC_UNCONFIRMED_CAST"}, justification = "it's a linter bug, there's no cast")
    protected TVDSectionPath linkOverlayNodes(OverlayPathEnd<TrackSection, Waypoint> path) {
        var fullPath = FullPathArray.from(path);

        // Build list of track sections position
        var trackSections = new ArrayList<TrackSectionRange>();
        var lastNode = fullPath.pathNodes.get(0);
        for (var nodeIndex = 1; nodeIndex < fullPath.pathNodes.size(); nodeIndex++) {
            var curNode = fullPath.pathNodes.get(nodeIndex);
            var endOffset = lastNode.edge == curNode.edge ? curNode.position : lastNode.edge.length;
            trackSections.add(new TrackSectionRange(lastNode.edge, lastNode.direction, lastNode.position, endOffset));
            lastNode = curNode;
        }

        var startNode = fullPath.start.overlayNode;
        EdgeDirection startNodeDirection = fullPath.start.direction;
        var endNode = fullPath.end.overlayNode;
        EdgeDirection endNodeDirection = fullPath.end.direction;
        double length = path.cost;

        var startNodeIndex = startNode.index;
        var endNodeIndex = endNode.index;

        // create the path and register it with the graph
        var tvdSectionPath = new TVDSectionPath(
                overlayGraph,
                startNodeIndex, startNodeDirection,
                endNodeIndex, endNodeDirection,
                length,
                trackSections);

        // fill the node adjacency lists
        var startNeighbors = startNode.getTvdSectionPathNeighbors(startNodeDirection);
        var endNeighbors = endNode.getTvdSectionPathNeighbors(endNodeDirection.opposite());

        startNeighbors.add(tvdSectionPath);
        // don't add the same node twice to the same adjacency list if this path is a loop on the same edge side
        if (startNeighbors != endNeighbors)
            endNeighbors.add(tvdSectionPath);

        var tvsSectionID = UndirectedBiEdgeID.from(startNodeIndex, endNodeIndex);
        var dupTvd = overlayGraph.tvdSectionPathMap.put(tvsSectionID, tvdSectionPath);
        // the same TVD Section shouldn't appear twice
        assert dupTvd == null;
        return tvdSectionPath;
    }
}
