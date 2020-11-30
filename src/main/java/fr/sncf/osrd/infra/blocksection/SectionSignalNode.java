package fr.sncf.osrd.infra.blocksection;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.graph.AbstractNode;
import java.util.List;

@SuppressFBWarnings(
        value = "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD",
        justification = "kept for later use"
)
public class SectionSignalNode extends AbstractNode<BlockSection> {
    public final String id;

    public SectionSignalNode(String id) {
        this.id = id;
    }

    @Override
    public void freeze() {
    }
}
