package fr.sncf.osrd.railml.routegraph;

import fr.sncf.osrd.infra.railjson.schema.RJSTrackSection;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.railml.tracksectiongraph.RMLTrackSectionGraph;
import fr.sncf.osrd.railml.tracksectiongraph.TrackNetElement;
import fr.sncf.osrd.utils.graph.*;

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
        super(overlayGraph.tvdSectionPathMap, baseGraph, overlayGraph);
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
    protected RMLTVDSectionPath linkOverlayNodes(
            RMLRouteWaypoint startNode,
            EdgeDirection startNodeDirection,
            RMLRouteWaypoint endNode,
            EdgeDirection endNodeDirection,
            double length
    ) {
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
        startNode.getNeighbors(startNodeDirection).add(tvdSectionPath);
        endNode.getNeighbors(endNodeDirection).add(tvdSectionPath);
        return tvdSectionPath;
    }
}
