package fr.sncf.osrd.infra.graph;

import fr.sncf.osrd.util.CryoFlatMap;
import fr.sncf.osrd.util.CryoList;
import fr.sncf.osrd.util.Freezable;

import java.util.List;

/**
 * <p>A pretty special graph, where edges hold all the topological information.
 * Relations are directed, from edge end to edge end.</p>
 * <p>Each edge end stores:</p>
 * <ul>
 *   <li>the list of neighbors reachable from there</li>
 *   <li>the id of the node</li>
 * </ul>

 *  <p>This graph is designed so nodes are easy to replace.</p>
 *
 * @param <NodeT> The types of the nodes
 * @param <EdgeT> The type of the edges
 */
public class Graph<NodeT extends AbstractNode<?>, EdgeT extends AbstractEdge<?>> implements Freezable {
    public final CryoList<NodeT> nodes = new CryoList<>();
    public final CryoList<EdgeT> edges = new CryoList<>();

    /**
     * Even though edges store the graph of relations between edges, we still need
     * to store the graph of links between nodes and edges.
     */
    public final CryoFlatMap<NodeT, List<EdgeT>> neighbors = new CryoFlatMap<>();

    public void register(NodeT node) {
        node.setIndex(nodes.size());
        nodes.add(node);
    }

    public void register(EdgeT edge) {
        edge.setIndex(edges.size());
        edges.add(edge);
    }

    public void replaceNode(int nodeId, NodeT newNode) {
        newNode.setIndex(nodeId);
        nodes.set(nodeId, newNode);
    }

    public List<EdgeT> getNeighbors(NodeT node) {
        return neighbors.get(node.getIndex());
    }

    @Override
    public void freeze() {
        for (var edge : edges)
            edge.freeze();
        for (var node : nodes)
            node.freeze();
        edges.freeze();
        nodes.freeze();
    }
}
