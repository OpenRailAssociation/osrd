package fr.sncf.osrd.infra;

public class TopoEdge extends AbstractEdge<TopoNode> {
    private final String id;
    private double edgeLength;

    public TopoEdge(String id, TopoNode startNode, TopoNode endNode, double edgeLength) {
        super(startNode, endNode);
        this.id = id;
        this.edgeLength = edgeLength;
    }
}
