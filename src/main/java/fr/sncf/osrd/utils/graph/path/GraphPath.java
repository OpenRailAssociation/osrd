package fr.sncf.osrd.utils.graph.path;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.ArrayDeque;
import java.util.ArrayList;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public final class GraphPath<
        EdgeT extends Edge,
        PathStartT extends PathChainStart<EdgeT, PathStartT, PathEndT>,
        PathEndT extends PathChainEnd<EdgeT, PathStartT, PathEndT>
        > {
    public final ArrayList<PathChainNode<EdgeT, PathStartT, PathEndT>> pathNodes;

    public final PathStartT start;
    public final PathEndT end;

    /** This constructor is not public on purpose, it's meant to be used by the fromChainEnd */
    private GraphPath(
            ArrayList<PathChainNode<EdgeT, PathStartT, PathEndT>> pathNodes,
            PathStartT start,
            PathEndT end
    ) {
        this.pathNodes = pathNodes;
        this.start = start;
        this.end = end;
    }

    /** Reconstructs a Path from a node chain */
    @SuppressWarnings("unchecked")
    public static <
            EdgeT extends Edge,
            PathStartT extends PathChainStart<EdgeT, PathStartT, PathEndT>,
            PathEndT extends PathChainEnd<EdgeT, PathStartT, PathEndT>
            > GraphPath<EdgeT, PathStartT, PathEndT> from(PathEndT chainEnd) {
        var elements = new ArrayDeque<PathChainNode<EdgeT, PathStartT, PathEndT>>();
        for (PathChainNode<EdgeT, PathStartT, PathEndT> cur = chainEnd; cur != null; cur = cur.getPrevious())
            elements.addFirst(cur);

        // cast the first path node to its correct type
        var firstNode = elements.getFirst();
        var chainStart = (PathStartT) firstNode;

        return new GraphPath<>(new ArrayList<>(elements), chainStart, chainEnd);
    }

    public interface PathSegmentCallback<EdgeT> {
        void feed(EdgeT edge, EdgeDirection dir, double begin, double end);
    }

    /** Builds the segments defined by the list of nodes */
    public void forAllSegments(PathSegmentCallback<EdgeT> callback) {
        PathChainNode<EdgeT, PathStartT, PathEndT> lastNode = pathNodes.get(0);
        for (int i = 1; i < pathNodes.size(); i++) {
            var node = pathNodes.get(i);
            var lastEdge = lastNode.edge;
            var newEdge = node.edge;
            var lastDirection = lastNode.direction;
            if (lastEdge == newEdge) {
                // if both nodes are on the same edge, we only need to push the space between the two edges
                feed(callback, lastEdge, lastDirection, lastNode.position, node.position);
            } else {
                // if the two nodes aren't on the same edge, push the segment from the last node to the end,
                // and from the beginning of the new edge to the new node
                feed(callback, lastEdge, lastDirection, lastNode.position, lastEdge.getLastPosition(lastDirection));
                feed(callback, lastEdge, node.direction, newEdge.getFirstPosition(node.direction), node.position);
            }
            lastNode = node;
        }
    }

    private static <EdgeT> void feed(
            PathSegmentCallback<EdgeT> callback,
            EdgeT edge,
            EdgeDirection dir,
            double begin,
            double end
    ) {
        if (begin != end)
            callback.feed(edge, dir, begin, end);
    }
}
