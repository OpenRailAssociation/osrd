package fr.sncf.osrd.utils.graph.overlay;

import static fr.sncf.osrd.utils.graph.EdgeDirection.*;

import fr.sncf.osrd.utils.graph.*;

import java.util.*;


/**
 * <p>This tool helps link two related graphs, where a base layer references an overlay
 * using a given bridge object type. Bridge objects are located along the edges of the base graph,
 * nodes in the overlay graph map to bridge objects, and edges in the overlay are paths between adjacent bridge objects
 * on the base graph.</p>
 *
 * <p>The algorithm is as follows:</p>
 * <ol>
 *   <li>create a node in the overlay graph for each bridge object</li>
 *   <li>link together the nodes of bridge objects on the same base edge</li>
 *   <li>for each base edge with bridge objects, look for paths to neighboring bridge objects in the base graph</li>
 * </ol>
 *
 * <p>Looking for neighbors is a recursive algorithm, which detects and ignores paths which:</p>
 * <ol>
 *   <li>were already explored from the other end of the path (using wasPathExploredFromEndToStart)</li>
 *   <li>loop on themselves (the edgeDirLastVisited array remembers which recursive call last visited an edge dir)</li>
 * </ol>
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

    private final HashMap<BridgeObjectT, OverlayNodeT> bridgeToOverlay = new HashMap<>();

    protected abstract List<? extends IPointValue<BridgeObjectT>> getBridgeObjects(BaseEdgeT edge);

    protected abstract OverlayNodeT makeOverlayNode(BridgeObjectT bridgeObject);

    /** Create an edge in the overlay */
    protected abstract void linkOverlayNodes(OverlayPathNode<BaseEdgeT, OverlayNodeT> path);

    private final int[] edgeDirLastVisited;

    /** If the graph isn't directed, the B -> A edge would be deduplicated if A -> B exists */
    public final boolean isDirected;

    /** Creates a graph overlay builder. */
    public BiGraphOverlayBuilder(
            BaseGraphT baseGraph,
            OverlayGraphT overlayGraph,
            boolean isDirected
    ) {
        this.baseGraph = baseGraph;
        this.overlayGraph = overlayGraph;
        this.isDirected = isDirected;
        this.edgeDirLastVisited = new int[baseGraph.getEdgeCount() * 2];
        Arrays.fill(this.edgeDirLastVisited, -1);
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
                var prevBridge = bridgeObjects.get(i - 1);
                var curBridge = bridgeObjects.get(i);

                var prevNode = bridgeToOverlay.get(prevBridge.getValue());
                var curNode = bridgeToOverlay.get(curBridge.getValue());

                var prevPos = prevBridge.getPosition();
                var curPos = curBridge.getPosition();

                var length = curBridge.getPosition() - prevBridge.getPosition();
                var path = new OverlayPathNode<>(baseEdge, prevPos, START_TO_STOP, prevNode);
                linkOverlayNodes(path.end(length, baseEdge, curPos, START_TO_STOP, curNode));

                // if the overlay is directed, also add backward links
                if (isDirected) {
                    path = new OverlayPathNode<>(baseEdge, prevPos, STOP_TO_START, prevNode);
                    linkOverlayNodes(path.end(length, baseEdge, curPos, STOP_TO_START, curNode));
                }
            }
        }

        // link overlay edges which span across base edges
        for (var baseEdge : baseGraph.iterEdges()) {
            var bridgeObjects = getBridgeObjects(baseEdge);
            if (bridgeObjects.isEmpty())
                continue;

            // start exploring at both ends of the edge
            for (var direction : EdgeDirection.values()) {
                // find the closest bridge object to the end of the end from a given direction
                IPointValue<BridgeObjectT> lastBridge;
                double spaceAfterLastBridge;
                if (direction == START_TO_STOP) {
                    lastBridge = bridgeObjects.get(bridgeObjects.size() - 1);
                    spaceAfterLastBridge = baseEdge.length - lastBridge.getPosition();
                } else {
                    lastBridge = bridgeObjects.get(0);
                    spaceAfterLastBridge = lastBridge.getPosition();
                }

                // start exploring all possible paths to other bridge objects from this one
                var lastNode = bridgeToOverlay.get(lastBridge.getValue());
                var pathStart = new OverlayPathNode<>(baseEdge, lastBridge.getPosition(), direction, lastNode);
                exploreNeighborsAtPathEnd(lastNode, direction, pathStart, spaceAfterLastBridge, !isDirected);
            }
        }
    }

    /**
     * Continues exploration at the end of some edge.
     * @param pathStart the overlay node which starts the path
     * @param pathStartDir the path start direction relative to the start node's edge
     * @param sourcePath the path to the start node
     * @param pendingPathCost the not yet accounted for cost of going from the last node to the end of the current edge
     * @param isPathBidirectional whether the currently explored path works both ways
     */
    private void exploreNeighborsAtPathEnd(
            OverlayNodeT pathStart,
            EdgeDirection pathStartDir,
            OverlayPathNode<BaseEdgeT, OverlayNodeT> sourcePath,
            double pendingPathCost,
            boolean isPathBidirectional
    ) {
        var baseEdge = sourcePath.edge;
        var baseEdgeDir = sourcePath.direction;
        var endpoint = baseEdgeDir == START_TO_STOP ? EdgeEndpoint.END : EdgeEndpoint.BEGIN;
        for (var neighborRel: baseGraph.getNeighborRels(baseEdge, endpoint)) {
            var neighborEdge = neighborRel.getEdge(baseEdge, baseEdgeDir);
            var neighborDir = neighborRel.getDirection(baseEdge, baseEdgeDir);

            // skip this neighbor if it was already visited from the same (startNode, startDir)
            // without this check, we might indefinitely recurse in a track loop
            var visitIndex = makeEdgeDirVisitIndex(neighborEdge, neighborDir);
            var visitID = makeNodeDirVisitID(pathStart, pathStartDir);
            if (edgeDirLastVisited[visitIndex] == visitID)
                continue;
            edgeDirLastVisited[visitIndex] = visitID;

            // if the edge has no bridge object, and thus no overlay node, continue exploring neighbors.
            // create a new path node so the path can be rebuilt afterwards, and update path directionality
            var neighborBridgeObjects = getBridgeObjects(neighborEdge);
            if (neighborBridgeObjects.isEmpty()) {
                var neighborFirstPos = neighborEdge.getFirstPosition(neighborDir);
                exploreNeighborsAtPathEnd(
                        pathStart,
                        pathStartDir,
                        sourcePath.chain(pendingPathCost, neighborEdge, neighborFirstPos, neighborDir),
                        neighborEdge.length,
                        isPathBidirectional && neighborRel.isBidirectional()
                );
                continue;
            }

            // find the first bridge on the edge, as well as the overlay node associated with it.
            // this node will be used as an end of the current path.
            double startToFirstBridgeDist;
            IPointValue<BridgeObjectT> firstBridge;
            if (neighborDir == START_TO_STOP) {
                firstBridge = neighborBridgeObjects.get(0);
                startToFirstBridgeDist = firstBridge.getPosition();
            } else {
                firstBridge = neighborBridgeObjects.get(neighborBridgeObjects.size() - 1);
                startToFirstBridgeDist = neighborEdge.length - firstBridge.getPosition();
            }
            var pathEnd = bridgeToOverlay.get(firstBridge.getValue());

            // if this path was already explored from pathEnd to pathStart, skip it
            if (wasPathExploredFromEndToStart(isPathBidirectional, pathStart, pathStartDir, pathEnd, neighborDir))
                continue;

            // the overlay edge between where we're coming and the first detector we run into
            linkOverlayNodes(
                    sourcePath.end(
                    pendingPathCost + startToFirstBridgeDist,
                    neighborEdge,
                    firstBridge.getPosition(),
                    neighborDir,
                    pathEnd
                    )
            );
        }
    }

    /**
     * Check if this path was already explored before. it can happen multiple times as bidirectional paths
     * are explored from both ends, and we can't figure it out until the path is complete.
     */
    private boolean wasPathExploredFromEndToStart(
            boolean isPathBidirectional,
            OverlayNodeT pathStart,
            EdgeDirection pathStartDir,
            OverlayNodeT pathEnd,
            EdgeDirection pathEndDir
    ) {
        // the path couldn't have been explored the other way around if it is unidirectional
        if (!isPathBidirectional)
            return false;

        // and the end node has a lower index, a previous iteration of the top-level
        // cross base edge linking loop has already created this exact same path
        if (pathEnd.index < pathStart.index)
            return true;

        // it's also the case when both sides of a node are connected to each other in a loop,
        // without any other node on the way. in this case, just ignore the second pass
        return pathEnd.index == pathStart.index
                && pathEndDir == pathStartDir
                && pathStartDir == STOP_TO_START;
    }


    /** Get the index at which to store the last time some edge was visited along some direction */
    private int makeEdgeDirVisitIndex(BaseEdgeT edge, EdgeDirection edgeDir) {
        return edge.index << 1 | edgeDir.id;
    }

    /** Returns a unique exploration root identifier */
    private int makeNodeDirVisitID(OverlayNodeT node, EdgeDirection pathStartDir) {
        return node.index << 1 | pathStartDir.id;
    }
}
