package fr.sncf.osrd.railjson.schema.infra.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;

@SuppressFBWarnings({"UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class SingleDirectionalRJSTrackRange extends RJSTrackRange {
    public EdgeDirection direction;
    public String track;

    @Override
    public ApplicableDirection getNavigability() {
        if (direction == EdgeDirection.START_TO_STOP)
            return ApplicableDirection.START_TO_STOP;
        return ApplicableDirection.STOP_TO_START;
    }

    public SingleDirectionalRJSTrackRange(EdgeDirection direction, String track) {
        this.direction = direction;
        this.track = track;
    }

    /**
     * Constructor
     */
    public SingleDirectionalRJSTrackRange(EdgeDirection direction, String track, double begin, double end) {
        this(direction, track);
        this.begin = begin;
        this.end = end;
    }
}