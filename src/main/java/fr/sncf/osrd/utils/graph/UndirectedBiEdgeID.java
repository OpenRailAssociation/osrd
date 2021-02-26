package fr.sncf.osrd.utils.graph;

import java.util.Objects;

public final class UndirectedBiEdgeID {
    public final int lowNodeIndex;
    public final int highNodeIndex;

    private UndirectedBiEdgeID(int lowNodeIndex, int highNodeIndex) {
        this.lowNodeIndex = lowNodeIndex;
        this.highNodeIndex = highNodeIndex;
    }

    @Override
    public int hashCode() {
        return Objects.hash(lowNodeIndex, highNodeIndex);
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (obj.getClass() != UndirectedBiEdgeID.class)
            return false;
        var o = (UndirectedBiEdgeID) obj;
        return lowNodeIndex == o.lowNodeIndex && highNodeIndex == o.highNodeIndex;
    }

    public static UndirectedBiEdgeID from(int startNode, int endNode) {
        return new UndirectedBiEdgeID(Math.min(startNode, endNode), Math.max(startNode, endNode));
    }
}