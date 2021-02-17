package fr.sncf.osrd.infra.graph;

import fr.sncf.osrd.util.CryoFlatMap;
import fr.sncf.osrd.util.CryoList;
import fr.sncf.osrd.util.Freezable;

import java.util.ArrayList;
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
public class Graph<NodeT extends AbstractNode<?>, EdgeT extends AbstractEdge<?>> {
    public final CryoList<NodeT> nodes;
    public final CryoList<EdgeT> edges;

    public Graph(CryoList<NodeT> nodes, CryoList<EdgeT> edges) {
        this.nodes = nodes;
        this.edges = edges;
    }

    public Graph() {
        this.nodes = new CryoList<>();
        this.edges = new CryoList<>();
    }

    public NodeT getNode(int index) {
        return nodes.get(index);
    }

    /**
     * Sets the node at some index, growing the array if necessary
     * @param index the index of the node to set or replace
     * @param node the node
     */
    public void setNode(int index, NodeT node) {
        resizeNodes(index + 1);
        node.setIndex(index);
        nodes.set(index, node);
    }

    public void register(NodeT node) {
        node.setIndex(nodes.size());
        nodes.add(node);
    }

    public void register(EdgeT edge) {
        edge.setIndex(edges.size());
        edges.add(edge);
    }

    /**
     * Grows the nodes array to a given size
     * @param numberOfNodes the minimum array size
     */
    public void resizeNodes(int numberOfNodes) {
        nodes.ensureCapacity(numberOfNodes);
        while (nodes.size() < numberOfNodes)
            nodes.add(null);
    }
}
