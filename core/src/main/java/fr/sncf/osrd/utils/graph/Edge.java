package fr.sncf.osrd.utils.graph;

public class Edge {
    public final int index;

    public final double length;

    public Edge(int index, double length) {
        this.index = index;
        this.length = length;
    }

    /** Gets the last valid edge position for a given direction */
    public final double getLastPosition(EdgeDirection direction) {
        if (direction == EdgeDirection.START_TO_STOP)
            return length;
        return 0;
    }

    /** Gets the first valid edge position for a given direction */
    public final double getFirstPosition(EdgeDirection direction) {
        return getLastPosition(direction.opposite());
    }
}
