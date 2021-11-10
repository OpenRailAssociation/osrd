package fr.sncf.osrd.utils.graph;

public interface INodeGraph<NodeT extends Node> {
    NodeT getNode(int i);

    int getNodeCount();

    Iterable<NodeT> iterNodes();

    void registerNode(NodeT node);

    int nextNodeIndex();

    void resizeNodes(int count);
}
