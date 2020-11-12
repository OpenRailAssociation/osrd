package fr.sncf.osrd.infra;

import java.util.ArrayList;
import java.util.List;

public class StopBlock extends Node {
    private final ArrayList<Edge> neighbor;

    public StopBlock(String id) {
        super(id);
        neighbor = new ArrayList<>();
    }

    public void setEdge(Edge edge) {
        assert neighbor.isEmpty(); // as a stop block only has one edge
        neighbor.clear();
        neighbor.add(edge);
    }

    @Override
    public List<Edge> getNeighbors(Edge from) {
        return neighbor;
    }
}
