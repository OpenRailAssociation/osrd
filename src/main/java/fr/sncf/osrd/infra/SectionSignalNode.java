package fr.sncf.osrd.infra;

import java.util.ArrayList;
import java.util.List;

public class SectionSignalNode extends AbstractNode<BlockSection> {
    public final String id;

    public SectionSignalNode(String id) {
        this.id = id;
    }

    @Override
    List<BlockSection> getNeighbors(BlockSection from) {
        if (from.startNode == this) {
            return from.startNeighbors;
        }
        assert this == from.endNode;
        return from.endNeighbors;
    }
}
