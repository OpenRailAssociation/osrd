package fr.sncf.osrd.utils.graph;


public interface IEdgeGraph<EdgeT extends Edge> {
    EdgeT getEdge(int i);

    int getEdgeCount();

    Iterable<EdgeT> iterEdges();
    
    void registerEdge(EdgeT edge);

    int nextEdgeIndex();
}
