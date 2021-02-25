package fr.sncf.osrd.utils.graph;

import fr.sncf.osrd.utils.CryoList;
import fr.sncf.osrd.utils.Freezable;

public class AbstractGraph<EdgeT extends AbstractEdge, NodeT extends AbstractNode> implements Freezable {
    private final CryoList<NodeT> nodes;
    private final CryoList<EdgeT> edges;

    public AbstractGraph(CryoList<NodeT> nodes, CryoList<EdgeT> edges) {
        this.nodes = nodes;
        this.edges = edges;
    }

    public NodeT getNode(int i) {
        return nodes.get(i);
    }
    
    public EdgeT getEdge(int i) {
        return edges.get(i);
    }

    public int getNodeCount() {
        return nodes.size();
    }

    public int getEdgeCount() {
        return edges.size();
    }

    public Iterable<NodeT> iterNodes() {
        return nodes;
    }

    public Iterable<EdgeT> iterEdges() {
        return edges;
    }
    
    public AbstractGraph() {
        this.nodes = new CryoList<>();
        this.edges = new CryoList<>();
    }

    /** Registers the given node into the graph, overriding the previous node at its index if any */
    public void registerNode(NodeT node) {
        if (node.index == nextNodeIndex())
            nodes.add(node);
        else
            nodes.set(node.index, node);
    }

    /** Registers the given edge into the graph, overriding the previous edge at its index if any */
    public void registerEdge(EdgeT edge) {
        if (edge.index == nextEdgeIndex())
            edges.add(edge);
        else
            edges.set(edge.index, edge);
    }

    public int nextNodeIndex() {
        return nodes.size();
    }

    public int nextEdgeIndex() {
        return edges.size();
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

    private boolean frozen = false;

    @Override
    public void freeze() {
        assert !frozen;
        nodes.freeze();
        edges.freeze();
        frozen = true;
    }

    @Override
    public boolean isFrozen() {
        return frozen;
    }
}
