package fr.sncf.osrd.infra.implementation.tracks.directed;

import static fr.sncf.osrd.railjson.schema.common.graph.EdgeEndpoint.endEndpoint;
import static fr.sncf.osrd.utils.graph.GraphHelpers.*;

import com.google.common.collect.HashBiMap;
import com.google.common.graph.ImmutableNetwork;
import com.google.common.graph.NetworkBuilder;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackEdge;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackNode;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackNode.Side;
import fr.sncf.osrd.infra.api.tracks.undirected.SwitchBranch;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackEdge;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackInfra;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackNode;
import fr.sncf.osrd.infra.implementation.tracks.undirected.UndirectedInfraBuilder;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeEndpoint;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.utils.UnionFind;
import java.util.HashMap;

public class DirectedInfraBuilder {
    /** Map from undirected node to directed node (forward) */
    private final HashMap<TrackNode, DiTrackNode> forwardNodeMap = new HashMap<>();
    /** Map from undirected node to directed node (backward) */
    private final HashMap<TrackNode, DiTrackNode> backwardNodeMap = new HashMap<>();
    /** Reference undirected graph*/
    private final ImmutableNetwork<TrackNode, TrackEdge> undirectedGraph;
    /** Reference undirected infra */
    private final TrackInfra trackInfra;
    /** Union find used to link directed nodes together*/
    private final UnionFind uf;
    /** Output graph builder */
    private final ImmutableNetwork.Builder<DiTrackNode, DiTrackEdge> graph;

    /** Constructor */
    private DirectedInfraBuilder(TrackInfra infra) {
        this.undirectedGraph = infra.getTrackGraph();
        uf = new UnionFind(undirectedGraph.edges().size() * 4);
        graph = NetworkBuilder.directed().immutable();
        trackInfra = infra;
    }

    /** Builds a directed infra from an undirected infra */
    public static DiTrackInfra fromUndirected(TrackInfra infra) {
        return new DirectedInfraBuilder(infra).convert();
    }

    /** Builds a directed infra from a RJS infra */
    public static DiTrackInfra fromRJS(RJSInfra infra) {
        var undirected = UndirectedInfraBuilder.parseInfra(infra);
        return fromUndirected(undirected);
    }

    /** Private function to call to convert the infra, with everything initialized */
    private DiTrackInfra convert() {

        // Creates the nodes
        for (var node : undirectedGraph.nodes()) {
            for (var side : Side.values()) {
                var newNode = new DiTrackNode(node, side);
                getMap(side).put(node, newNode);
                graph.addNode(newNode);
            }
        }

        // Links the tracks together using the union find
        for (var edge : undirectedGraph.edges()) {
            for (var direction : Direction.values()) {
                for (var adjacent : adjacentEdges(undirectedGraph, edge, endEndpoint(direction))) {
                    if (canGoFromAToB(edge, adjacent)) {
                        linkEdges(edge, adjacent, nodeFromEdgeEndpoint(undirectedGraph, edge, endEndpoint(direction)));
                    }
                }
            }
        }
        // Creates the edges and build the graph
        makeEdges();
        return new DiTrackInfraImpl(trackInfra, graph.build());
    }

    /** Builds every directed edge and registers them in the graph builder */
    private void makeEdges() {
        var nodes = HashBiMap.<Integer, DiTrackNode>create();
        for (var edge : undirectedGraph.edges()) {
            for (var dir : Direction.values()) {
                makeEdge(nodes, edge, dir);
            }
        }
    }

    /** Creates an edge and registers it in the graph */
    private void makeEdge(HashBiMap<Integer, DiTrackNode> nodes, TrackEdge edge, Direction dir) {
        var begin = findNode(nodes, edge, dir, endEndpoint(dir.opposite()));
        var end = findNode(nodes, edge, dir, endEndpoint(dir));
        var newEdge = new DiTrackEdgeImpl(edge, dir);
        graph.addEdge(begin, end, newEdge);
    }

    /** Finds the node matching the edge / endpoint / direction.
     * If one matching the union is already picked, returns the same.
     * Otherwise, picks any unused direction for the node */
    private DiTrackNode findNode(HashBiMap<Integer, DiTrackNode> nodes, TrackEdge edge,
                                 Direction dir, EdgeEndpoint endpoint) {
        var group = uf.findRoot(getEndpointGroup(edge, dir, endpoint));
        if (nodes.containsKey(group))
            return nodes.get(group);
        var node = nodeFromEdgeEndpoint(undirectedGraph, edge, endpoint);
        var diNode = getMap(Side.A).get(node);
        if (nodes.containsValue(diNode))
            diNode = getMap(Side.B).get(node);
        assert !nodes.containsValue(diNode);
        nodes.put(group, diNode);
        return diNode;
    }

    /** Links two edges across the given node, registering it in the union find */
    private void linkEdges(TrackEdge a, TrackEdge b, TrackNode node) {
        var endpointA = endpointOfNode(undirectedGraph, a, node);
        var endpointB = endpointOfNode(undirectedGraph, b, node);
        var invertedDirection = endpointA == endpointB;
        for (var direction : Direction.values()) {
            var otherDirection = invertedDirection ? direction.opposite() : direction;
            uf.union(
                    getEndpointGroup(a, direction, endpointA),
                    getEndpointGroup(b, otherDirection, endpointB)
            );
        }
    }

    /** Returns the union find ID for the given (edge, direction, endpoint) */
    private int getEndpointGroup(TrackEdge edge, Direction direction, EdgeEndpoint endpoint) {
        return edge.getIndex() * 4
                + (direction == Direction.FORWARD ? 2 : 0)
                + (endpoint == EdgeEndpoint.END ? 1 : 0);
    }

    /** Returns whether we can link the two edges together */
    private static boolean canGoFromAToB(TrackEdge a, TrackEdge b) {
        return isNotSwitchBranch(a) || isNotSwitchBranch(b);
    }

    /** Is the edge something other than a switch branch */
    private static boolean isNotSwitchBranch(TrackEdge edge) {
        return !(edge instanceof SwitchBranch);
    }

    /** Returns either (node -> directed node) map matching the given side */
    private HashMap<TrackNode, DiTrackNode> getMap(Side side) {
        if (side == Side.A)
            return forwardNodeMap;
        else
            return backwardNodeMap;
    }
}
