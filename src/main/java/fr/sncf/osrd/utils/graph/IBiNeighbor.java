package fr.sncf.osrd.utils.graph;

public interface IBiNeighbor<EdgeT> {
    EdgeT getEdge(EdgeT originEdge, EdgeDirection direction);

    EdgeDirection getDirection(EdgeT originEdge, EdgeDirection direction);
}
