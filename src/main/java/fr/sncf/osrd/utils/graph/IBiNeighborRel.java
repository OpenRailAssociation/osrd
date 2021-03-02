package fr.sncf.osrd.utils.graph;

public interface IBiNeighborRel<EdgeT> {
    EdgeT getEdge(EdgeT originEdge, EdgeDirection direction);

    EdgeDirection getDirection(EdgeT originEdge, EdgeDirection direction);

    // returns whether this neighborhood relationship can be navigated both ways
    boolean isBidirectional();
}
