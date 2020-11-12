package fr.sncf.osrd.infra;

public class Edge implements AbstractEdge<Node> {
    private final String id;
    private Node startNode;
    private Node endNode;
    private double edgeLength;

    public Edge(String id, Node startNode, Node endNode, double edgeLength) {
        this.id = id;
        this.startNode = startNode;
        this.endNode = endNode;
        this.edgeLength = edgeLength;
    }
    @Override
    public Node getStartNode() {
        return startNode;
    }

    @Override
    public Node getEndNode() {
        return endNode;
    }
}
