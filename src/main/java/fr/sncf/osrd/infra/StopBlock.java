package fr.sncf.osrd.infra;

import java.util.ArrayList;
import java.util.List;

/**
 * A stop block prevents trains from going past the end of a track.
 * https://en.wikipedia.org/wiki/Buffer_stop
 */
public class StopBlock extends TopoNode {
    private final ArrayList<TopoEdge> neighbor;

    public StopBlock(String id) {
        super(id);
        neighbor = new ArrayList<>();
    }

    /** Sets the edge the stop block terminates. */
    void setEdge(TopoEdge edge) {
        assert neighbor.isEmpty(); // as a stop block only has one edge
        neighbor.clear();
        neighbor.add(edge);
    }

    @Override
    public List<TopoEdge> getNeighbors(TopoEdge from) {
        return neighbor;
    }
}
