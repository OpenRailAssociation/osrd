package fr.sncf.osrd.railjson.schema.infra;

import fr.sncf.osrd.railjson.schema.common.RJSWaypointRef;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeEndpoint;
import java.util.Objects;

/** An identifier for a side of a specific track section */
public final class RJSTrackEndpoint {
    public String track;
    public EdgeEndpoint endpoint;

    public RJSTrackEndpoint(String track, EdgeEndpoint endpoint) {
        this.track = track;
        this.endpoint = endpoint;
    }

    @Override
    public int hashCode() {
        return Objects.hash(track, endpoint);
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;
        if (obj.getClass() != RJSTrackEndpoint.class)
            return false;
        var o = (RJSTrackEndpoint) obj;
        return track.equals(o.track) && endpoint.equals(o.endpoint);
    }

    @Override
    public String toString() {
        return String.format(
                "RJSTrackEndpoint { section=%s, endpoint=%s }",
                track, endpoint.toString()
        );
    }
}
