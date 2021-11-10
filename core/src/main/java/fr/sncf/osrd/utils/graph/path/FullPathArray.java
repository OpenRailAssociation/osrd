package fr.sncf.osrd.utils.graph.path;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.graph.Edge;
import java.util.ArrayDeque;
import java.util.ArrayList;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class FullPathArray<EdgeT extends Edge, NodeT extends PathNode<EdgeT, NodeT>> {
    public final ArrayList<NodeT> pathNodes;

    public final NodeT start;
    public final NodeT end;

    /** This constructor is not public on purpose, it's meant to be used by the fromChainEnd */
    protected FullPathArray(
            ArrayList<NodeT> pathNodes,
            NodeT start,
            NodeT end
    ) {
        this.pathNodes = pathNodes;
        this.start = start;
        this.end = end;
    }

    /** Reconstructs a Path from a node chain */
    public static <EdgeT extends Edge, NodeT extends PathNode<EdgeT, NodeT>> FullPathArray<EdgeT, NodeT> from(
            NodeT endNode
    ) {
        assert endNode.type == PathNode.Type.END;
        var elements = new ArrayDeque<NodeT>();
        for (NodeT cur = endNode; cur != null; cur = cur.getPrevious())
            elements.addFirst(cur);

        // Get the first node of the chain
        var firstNode = elements.getFirst();
        assert firstNode.type == PathNode.Type.START;

        return new FullPathArray<EdgeT, NodeT>(new ArrayList<>(elements), firstNode, endNode);
    }
}
