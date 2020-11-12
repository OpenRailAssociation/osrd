package fr.sncf.osrd.infra;

import java.util.ArrayList;
import java.util.List;

public class StopBlock extends TopoNode {
    private final ArrayList<TopoEdge> neighbor;

    public StopBlock(String id) {
        super(id);
        neighbor = new ArrayList<>();
    }

    public void setEdge(TopoEdge edge) {
        assert neighbor.isEmpty(); // as a stop block only has one edge
        neighbor.clear();
        neighbor.add(edge);
    }

    @Override
    public List<TopoEdge> getNeighbors(TopoEdge from) {
        return neighbor;
    }
}
