package fr.sncf.osrd.railml.routegraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railjson.schema.RJSTrackSection;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.railml.tracksectiongraph.RMLTrackSectionGraph;
import fr.sncf.osrd.railml.tracksectiongraph.TrackNetElement;
import fr.sncf.osrd.utils.graph.*;
import fr.sncf.osrd.utils.graph.overlay.BiGraphOverlayBuilder;
import fr.sncf.osrd.utils.graph.overlay.OverlayPathEnd;
import fr.sncf.osrd.utils.graph.path.FullPathArray;

import java.util.HashMap;
import java.util.List;

public final class RMLRouteGraphBuilder extends BiGraphOverlayBuilder<
        RJSRouteWaypoint,
        TrackNetElement,
        RMLTrackSectionGraph,
        RMLRouteWaypoint,
        RMLTVDSectionPath,
        RMLRouteGraph> {
    private final HashMap<String, RJSTrackSection> rjsTrackSections;

    public RMLRouteGraphBuilder(
            HashMap<String, RJSTrackSection> rjsTrackSections,
            RMLTrackSectionGraph baseGraph,
            RMLRouteGraph overlayGraph
    ) {
        super(baseGraph, overlayGraph, false);
        this.rjsTrackSections = rjsTrackSections;
    }

    @Override
    protected List<RJSRouteWaypoint> getBridgeObjects(TrackNetElement edge) {
        return rjsTrackSections.get(edge.id).routeWaypoints;
    }

    @Override
    protected RMLRouteWaypoint makeOverlayNode(RJSRouteWaypoint bridgeObject) {
        var node = new RMLRouteWaypoint(overlayGraph, overlayGraph.nextNodeIndex());
        overlayGraph.waypointsMap.put(bridgeObject.id, node);
        return node;
    }

    @Override
    @SuppressFBWarnings(value = {"BC_UNCONFIRMED_CAST"}, justification = "it's a linter bug, there's no cast")
    protected RMLTVDSectionPath linkOverlayNodes(OverlayPathEnd<TrackNetElement, RMLRouteWaypoint> path) {
        var fullPath = FullPathArray.from(path);

        var startNode = fullPath.start.overlayNode;
        var startNodeDirection = fullPath.start.direction;
        var endNode = fullPath.end.overlayNode;
        var endNodeDirection = fullPath.end.direction;
        double length = path.cost;

        var startNodeIndex = startNode.index;
        var endNodeIndex = endNode.index;

        // create the path and register it with the graph
        var tvdSectionPath = new RMLTVDSectionPath(
                overlayGraph,
                startNodeIndex, startNodeDirection,
                endNodeIndex, endNodeDirection,
                length
        );

        // fill the node adjacency lists
        var startNeighbors = startNode.getNeighbors(startNodeDirection);
        var endNeighbors = endNode.getNeighbors(endNodeDirection);

        startNeighbors.add(tvdSectionPath);

        // avoid adding the node to the same adjacency list twice. this happens in case of loops on the same edge end
        if (startNeighbors != endNeighbors)
            endNeighbors.add(tvdSectionPath);

        overlayGraph.tvdSectionPathMap.put(UndirectedBiEdgeID.from(startNodeIndex, endNodeIndex), tvdSectionPath);
        return tvdSectionPath;
    }
}
