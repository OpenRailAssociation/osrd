package fr.sncf.osrd.utils.graph;

import com.google.common.graph.EndpointPair;
import fr.sncf.osrd.new_infra.api.Direction;

/** Encodes an end, an endpoint, the tip of an edge. */
public enum EdgeEndpoint {
    BEGIN(0),
    END(1);

    public final int id;

    EdgeEndpoint(int id) {
        this.id = id;
    }

    /** Return the first met endpoint along the edge in the given direction */
    public static EdgeEndpoint startEndpoint(Direction dir) {
        if (dir == Direction.FORWARD)
            return BEGIN;
        return END;
    }

    /** deprecated */
    public static EdgeEndpoint startEndpointOld(EdgeDirection dir) {
        if (dir == EdgeDirection.START_TO_STOP)
            return BEGIN;
        return END;
    }

    /** Return the last met endpoint along the edge in the given direction */
    public static EdgeEndpoint endEndpoint(Direction dir) {
        return startEndpoint(dir.opposite());
    }
}
