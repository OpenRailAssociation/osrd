package fr.sncf.osrd.utils.graph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public abstract class DirNEdge extends Edge {
    public final int startNode;
    public final int endNode;

    protected DirNEdge(int index, int startNode, int endNode, double length) {
        super(index, length);
        this.startNode = startNode;
        this.endNode = endNode;
    }
}
