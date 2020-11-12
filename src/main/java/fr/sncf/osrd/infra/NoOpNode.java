package fr.sncf.osrd.infra;

import java.util.ArrayList;
import java.util.List;

public class NoOpNode extends Node {
    private final ArrayList<Edge> neighbors;

    public NoOpNode(String id, long index) {
        super(id, index);
        neighbors = new ArrayList<>();
    }

    public void addEdge(Edge edge) {
        neighbors.add(edge);
    }

    @Override
    public List<Edge> getNeighbors(Edge from) {
        return neighbors;
    }
}
