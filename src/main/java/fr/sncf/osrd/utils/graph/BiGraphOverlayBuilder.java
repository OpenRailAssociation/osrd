package fr.sncf.osrd.utils.graph;

import static fr.sncf.osrd.utils.graph.EdgeDirection.*;

import java.util.*;


/**
 * This tool helps link two related graphs, where a base layer references an overlay
 * using a given bridge object type. Bridge objects are located along the edges of the base graph.
 */
public abstract class BiGraphOverlayBuilder<
        BridgeObjectT,
        BaseEdgeT extends Edge,
        BaseGraphT extends BiGraph<BaseEdgeT>,
        OverlayNodeT extends Node,
        OverlayEdgeT extends BiNEdge<OverlayEdgeT>,
        OverlayGraphT extends BiNGraph<OverlayEdgeT, OverlayNodeT>
        > {
    protected final BaseGraphT baseGraph;
    protected final OverlayGraphT overlayGraph;

    private final BitSet[] visitedEdgeDirs;
    private final HashMap<BridgeObjectT, OverlayNodeT> bridgeToOverlay = new HashMap<>();

    protected abstract List<? extends IPointValue<BridgeObjectT>> getBridgeObjects(BaseEdgeT edge);

    protected abstract OverlayNodeT makeOverlayNode(BridgeObjectT bridgeObject);

    /**
     * Create an edge in the overlay
     *
     * @param startNode start bridge node id
     * @param startNodeDirection the direction on the base graph when going to the endNode from the startNode
     * @param endNode end bridge node id
     * @param endNodeDirection the direction on the base graph when going to the startNode from the endNode
     * @param length length of the SectionPath
     * @return the overlay edge
     */
    protected abstract OverlayEdgeT linkOverlayNodes(
            OverlayNodeT startNode,
            EdgeDirection startNodeDirection,
            OverlayNodeT endNode,
            EdgeDirection endNodeDirection,
            double length
    );

    public void markAsVisited(BaseEdgeT edge, EdgeDirection dir) {
        visitedEdgeDirs[dir.id].set(edge.index);
    }

    public boolean wasVisitedInAnyDirection(BaseEdgeT edge) {
        var edgeIndex = edge.index;
        return visitedEdgeDirs[START_TO_STOP.id].get(edgeIndex) || visitedEdgeDirs[STOP_TO_START.id].get(edgeIndex);
    }

    /** Creates a graph overlay builder. */
    public BiGraphOverlayBuilder(
            HashMap<UndirectedBiEdgeID, OverlayEdgeT> overlayEdges,
            BaseGraphT baseGraph,
            OverlayGraphT overlayGraph
    ) {
        this.overlayEdges = overlayEdges;
        this.baseGraph = baseGraph;
        this.overlayGraph = overlayGraph;
        var edgeCount = baseGraph.getEdgeCount();
        this.visitedEdgeDirs = new BitSet[] {
                new BitSet(edgeCount), // START_TO_STOP
                new BitSet(edgeCount)  // STOP_TO_START
        };
    }

    /** Builds the overlay */
    public void build() {
        // create overlay nodes
        for (var baseEdge : baseGraph.iterEdges())
            for (var bridgeObjectPoint : getBridgeObjects(baseEdge))
                bridgeToOverlay.put(bridgeObjectPoint.getValue(), makeOverlayNode(bridgeObjectPoint.getValue()));

        // create overlay edges that begin and end on the same edge
        for (var baseEdge : baseGraph.iterEdges()) {
            var bridgeObjects = getBridgeObjects(baseEdge);
            for (int i = 1; i < bridgeObjects.size(); i++) {
                var lastBridge = bridgeObjects.get(i - 1);
                var curBridge = bridgeObjects.get(i);

                var lastNode = bridgeToOverlay.get(lastBridge.getValue());
                var curNode = bridgeToOverlay.get(curBridge.getValue());

                var length = curBridge.getPosition() - lastBridge.getPosition();
                overlayRegisterEdge(linkOverlayNodes(lastNode, START_TO_STOP, curNode, STOP_TO_START, length));
            }
        }

        // link cross-base edge overlay edges
        for (var baseEdge : baseGraph.iterEdges()) {
            if (wasVisitedInAnyDirection(baseEdge))
                continue;

            var bridgeObjects = getBridgeObjects(baseEdge);
            if (bridgeObjects.isEmpty())
                continue;

            var lastBridge = bridgeObjects.get(bridgeObjects.size() - 1);
            markAsVisited(baseEdge, START_TO_STOP);
            traverseBaseGraph(
                    baseEdge, START_TO_STOP,
                    bridgeToOverlay.get(lastBridge.getValue()), START_TO_STOP,
                    baseEdge.length - lastBridge.getPosition()
            );

            var firstBridge = bridgeObjects.get(0);
            markAsVisited(baseEdge, STOP_TO_START);
            traverseBaseGraph(
                    baseEdge, STOP_TO_START,
                    bridgeToOverlay.get(firstBridge.getValue()), STOP_TO_START,
                    firstBridge.getPosition()
            );
        }
    }


    /**
     * Arriving from baseEdge with direction baseEdgeDir on it.
     * The last seen bridge was overlayNode, and the current distance to it is overlayPathLength.
     * overlayNodeDir is the direction we were traversing the overlayNode's baseEdge with.
     */
    private void traverseBaseGraph(
            BaseEdgeT baseEdge,
            EdgeDirection baseEdgeDir,
            OverlayNodeT overlayNode,
            EdgeDirection overlayNodeDir,
            double overlayPathLength
    ) {
        var endpoint = baseEdgeDir == START_TO_STOP ? EdgeEndpoint.END : EdgeEndpoint.BEGIN;
        for (var neighbor: baseGraph.getNeighbors(baseEdge, endpoint)) {
            var neighborEdge = neighbor.getEdge(baseEdge, baseEdgeDir);
            var neighborDir = neighbor.getDirection(baseEdge, baseEdgeDir);

            // if the neighbor was already visited from this direction, skip it
            if (visitedEdgeDirs[neighborDir.id].get(neighborEdge.index))
                continue;

            markAsVisited(neighborEdge, neighborDir);

            linkOverlayNodesBetweenEdges(
                    neighborEdge, neighborDir,
                    overlayNode, overlayNodeDir,
                    overlayPathLength
            );
        }
    }

    /**
     * Arriving onto baseEdge with direction baseEdgeDir, the last seen bridge was overlayNode, which is
     * overlayPathLength away from the beginning of the baseEdge. overlayNodeDir is the direction we
     * were traversing the overlayNode's baseEdge with.
     */
    private void linkOverlayNodesBetweenEdges(
            BaseEdgeT baseEdge,
            EdgeDirection baseEdgeDir,
            OverlayNodeT overlayNode,
            EdgeDirection overlayNodeDir,
            double overlayPathLength
    ) {
        var bridgeObjects = getBridgeObjects(baseEdge);
        // if the base edge has no bridges, skip it
        if (bridgeObjects.isEmpty()) {
            traverseBaseGraph(
                    baseEdge,
                    baseEdgeDir,
                    overlayNode,
                    overlayNodeDir,
                    overlayPathLength + baseEdge.length
            );
            return;
        }

        var firstEdgeBridge = bridgeObjects.get(0);
        var lastEdgeBridge = bridgeObjects.get(bridgeObjects.size() - 1);
        var firstEdgeOverlayNode = bridgeToOverlay.get(firstEdgeBridge.getValue());
        var lastEdgeOverlayNode = bridgeToOverlay.get(lastEdgeBridge.getValue());
        final var firstOverlayNode = baseEdgeDir == START_TO_STOP ? firstEdgeOverlayNode : lastEdgeOverlayNode;
        final var lastOverlayNode = baseEdgeDir == START_TO_STOP ? lastEdgeOverlayNode : firstEdgeOverlayNode;

        // Check if this same overlay edge was already handled
        if (overlayHasEdge(overlayNode.index, firstOverlayNode.index))
            return;

        double startToFirstBridgeDist;
        double lastBridgeToEndDist;
        if (baseEdgeDir == START_TO_STOP) {
            startToFirstBridgeDist = firstEdgeBridge.getPosition();
            lastBridgeToEndDist = baseEdge.length - lastEdgeBridge.getPosition();
        } else {
            startToFirstBridgeDist = baseEdge.length - lastEdgeBridge.getPosition();
            lastBridgeToEndDist = firstEdgeBridge.getPosition();
        }

        // the overlay edge between where we're coming and the first detector we run into
        overlayRegisterEdge(linkOverlayNodes(
                overlayNode, overlayNodeDir,
                firstOverlayNode, baseEdgeDir.opposite(),
                overlayPathLength + startToFirstBridgeDist
        ));

        // backward traversal
        traverseBaseGraph(
                baseEdge,
                baseEdgeDir.opposite(),
                firstOverlayNode,
                baseEdgeDir.opposite(),
                startToFirstBridgeDist
        );

        // continue traversal forward
        traverseBaseGraph(
                baseEdge,
                baseEdgeDir,
                lastOverlayNode,
                baseEdgeDir,
                lastBridgeToEndDist
        );
    }

    public final HashMap<UndirectedBiEdgeID, OverlayEdgeT> overlayEdges;

    private void overlayRegisterEdge(OverlayEdgeT edge) {
        overlayEdges.put(UndirectedBiEdgeID.from(edge.startNode, edge.endNode), edge);
    }

    private boolean overlayHasEdge(int startNode, int endNode) {
        return overlayEdges.containsKey(UndirectedBiEdgeID.from(startNode, endNode));
    }
}
