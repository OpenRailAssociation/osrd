package fr.sncf.osrd.infra;

public abstract class Node implements AbstractNode<Edge> {
    private final String id;

    public Node(String id) {
        this.id = id;
    }
}
