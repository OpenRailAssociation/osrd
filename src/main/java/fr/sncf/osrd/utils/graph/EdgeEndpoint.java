package fr.sncf.osrd.utils.graph;

/** Encodes an end, an endpoint, the tip of an edge. */
public enum EdgeEndpoint {
    BEGIN(0),
    END(1);

    public final int id;

    EdgeEndpoint(int id) {
        this.id = id;
    }
}
