package fr.sncf.osrd.infra.topological;

import fr.sncf.osrd.util.CryoList;
import java.util.List;

public class NoOpNode extends TopoNode {
    private final CryoList<TopoEdge> neighbors = new CryoList<>();

    public NoOpNode(String id) {
        super(id);
    }

    public NoOpNode addEdge(TopoEdge edge) {
        neighbors.add(edge);
        return this;
    }

    @Override
    public void freeze() {
        this.neighbors.freeze();
    }
}
