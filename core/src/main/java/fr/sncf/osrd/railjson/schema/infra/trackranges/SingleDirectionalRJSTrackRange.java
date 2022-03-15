package fr.sncf.osrd.railjson.schema.infra.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import fr.sncf.osrd.utils.graph.EdgeDirection;

@SuppressFBWarnings({"UWF_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class SingleDirectionalRJSTrackRange extends RJSTrackRange {
    public EdgeDirection direction;
    public RJSObjectRef<RJSTrackSection> track;

    @Override
    public ApplicableDirection getNavigability() {
        if (direction == EdgeDirection.START_TO_STOP)
            return ApplicableDirection.NORMAL;
        return ApplicableDirection.REVERSE;
    }

    public SingleDirectionalRJSTrackRange(EdgeDirection direction, RJSObjectRef<RJSTrackSection> track) {
        this.direction = direction;
        this.track = track;
    }
}
