package fr.sncf.osrd.infra;

import java.util.ArrayList;
import java.util.List;

public class NoOpNode extends TopoNode {
    private final ArrayList<TopoEdge> neighbors;

    public NoOpNode(String id) {
        super(id);
        neighbors = new ArrayList<>();
    }

    public void addEdge(TopoEdge edge) {
        neighbors.add(edge);
    }

    @Override
    public List<TopoEdge> getNeighbors(TopoEdge from) {
        return neighbors;
    }
}
