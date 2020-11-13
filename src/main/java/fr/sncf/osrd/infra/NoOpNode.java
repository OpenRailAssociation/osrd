package fr.sncf.osrd.infra;

import java.util.ArrayList;
import java.util.List;

public class NoOpNode extends TopoNode {
    private final ArrayList<TopoEdge> neighbors = new ArrayList<>();

    public NoOpNode(String id) {
        super(id);
    }

    public void addEdge(TopoEdge edge) {
        neighbors.add(edge);
    }

    @Override
    public List<TopoEdge> getNeighbors(TopoEdge from) {
        return neighbors;
    }
}
