package fr.sncf.osrd.infra;

public interface AbstractEdge<N extends AbstractNode> {
    N getStartNode();
    N getEndNode();
}
