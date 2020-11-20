package fr.sncf.osrd.infra.blocksection;

import fr.sncf.osrd.infra.graph.AbstractNode;
import java.util.List;

public class SectionSignalNode extends AbstractNode<BlockSection> {
    public final String id;

    public SectionSignalNode(String id) {
        this.id = id;
    }

    @Override
    public List<BlockSection> getNeighbors(BlockSection from) {
        if (from.startNode == this) {
            return from.startNeighbors;
        }
        assert this == from.endNode;
        return from.endNeighbors;
    }

    @Override
    public void freeze() {
    }
}
