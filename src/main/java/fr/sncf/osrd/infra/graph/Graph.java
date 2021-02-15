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

    public void setNode(int index, NodeT node) {
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

    // TODO: deprecate, it's only use in the railML parser and shouldn't
    public void resizeNodes(int numberOfNodes) {
        while (nodes.size() < numberOfNodes)
            nodes.add(null);
    }
}
