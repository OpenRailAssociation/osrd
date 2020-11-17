package fr.sncf.osrd.infra.topological;

import fr.sncf.osrd.util.CryoList;
import java.util.List;

/**
 * A stop block prevents trains from going past the end of a track.
 * https://en.wikipedia.org/wiki/Buffer_stop
 */
public class StopBlock extends TopoNode {
    private final CryoList<TopoEdge> neighbor = new CryoList<>();

    public StopBlock(String id) {
        super(id);
    }

    /** Sets the edge the stop block terminates. */
    void setEdge(TopoEdge edge) {
        neighbor.clear();
        neighbor.add(edge);
    }

    @Override
    public List<TopoEdge> getNeighbors(TopoEdge from) {
        return neighbor;
    }

    @Override
    public void freeze() {
        neighbor.freeze();
    }
}
