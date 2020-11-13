package fr.sncf.osrd.infra;

import java.util.ArrayList;
import java.util.List;

public class SectionSignalNode extends AbstractNode<BlockSection> {
    public final String id;

    public SectionSignalNode(String id) {
        this.id = id;
    }

    ArrayList<BlockSection> neighbors = new ArrayList<>();

    void addNeighbor(BlockSection bs) {
        neighbors.add(bs);
    }

    @Override
    List<BlockSection> getNeighbors(BlockSection from) {
        return neighbors;
    }
}
