package fr.sncf.osrd.infra;

public abstract class Node implements AbstractNode<Edge> {
    private final String id;
    private final long index;

    public Node(String id, long index) {
        this.id = id;
        this.index = index;
    }
    @Override
    public long getIndex() {
        return index;
    }
}
