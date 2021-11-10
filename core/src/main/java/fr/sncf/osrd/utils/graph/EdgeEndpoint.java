package fr.sncf.osrd.utils.graph;

/** Encodes an end, an endpoint, the tip of an edge. */
public enum EdgeEndpoint {
    BEGIN(0),
    END(1);

    public final int id;

    EdgeEndpoint(int id) {
        this.id = id;
    }

    /** Return the first met endpoint along the edge in the given direction */
    public static EdgeEndpoint startEndpoint(EdgeDirection dir) {
        if (dir == EdgeDirection.START_TO_STOP)
            return BEGIN;
        return END;
    }
}
