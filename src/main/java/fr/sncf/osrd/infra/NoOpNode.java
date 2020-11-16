package fr.sncf.osrd.infra;

import fr.sncf.osrd.util.CryoList;

import java.util.List;

public class NoOpNode extends TopoNode {
    private final CryoList<TopoEdge> neighbors = new CryoList<>();

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

    @Override
    public void freeze() {
        this.neighbors.freeze();
    }
}
