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
import fr.sncf.osrd.utils.graph.overlay.OverlayPathStart;
import fr.sncf.osrd.utils.graph.path.FullPathArray;
import fr.sncf.osrd.utils.graph.path.PathNode;

import java.util.ArrayDeque;
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

        var startNode = fullPath.start.overlayNode;
        EdgeDirection startNodeDirection = fullPath.start.direction;
        var endNode = fullPath.end.overlayNode;
        EdgeDirection endNodeDirection = fullPath.end.direction;
        double length = path.cost;

        var startNodeIndex = startNode.index;
        var endNodeIndex = endNode.index;
        var trackSections = buildTrackSectionsFromFullPath(fullPath.pathNodes);

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

    private static ArrayList<TrackSectionRange> buildTrackSectionsFromFullPath(
            ArrayList<PathNode<TrackSection, OverlayPathStart<TrackSection, Waypoint>,
                    OverlayPathEnd<TrackSection, Waypoint>>> pathNodes
    ) {
        var trackSections = new ArrayList<TrackSectionRange>();
        var firstNode = pathNodes.get(0);
        var firstTrackEndPosition = firstNode.edge.length;
        if (firstNode.direction == EdgeDirection.STOP_TO_START)
            firstTrackEndPosition = 0;

        // Corner case only one track section
        if (firstNode.edge == pathNodes.get(1).edge) {
            assert pathNodes.size() == 2;
            firstTrackEndPosition = pathNodes.get(1).position;
            var firstTrack = new TrackSectionRange(firstNode.edge, firstNode.direction,
                    firstNode.position, firstTrackEndPosition);
            trackSections.add(firstTrack);
            return trackSections;

        }
        var firstTrack = new TrackSectionRange(firstNode.edge, firstNode.direction,
                firstNode.position, firstTrackEndPosition);

        trackSections.add(firstTrack);

        for (var nodeIndex = 1; nodeIndex < pathNodes.size() - 1; nodeIndex++) {
            var curNode = pathNodes.get(nodeIndex);
            var endPosition = curNode.edge.length - curNode.position;
            var trackSection = new TrackSectionRange(curNode.edge, curNode.direction, curNode.position, endPosition);
            trackSections.add(trackSection);
        }

        // Last node case
        var lastNode = pathNodes.get(pathNodes.size() - 1);
        double lastTrackBeginPosition = 0.;
        if (lastNode.direction == EdgeDirection.STOP_TO_START)
            lastTrackBeginPosition = lastNode.edge.length;
        trackSections.add(
                new TrackSectionRange(lastNode.edge, lastNode.direction, lastTrackBeginPosition, lastNode.position));

        return trackSections;
    }
}
