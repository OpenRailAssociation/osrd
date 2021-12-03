package fr.sncf.osrd.railjson.schema.infra.trackranges;

import fr.sncf.osrd.railjson.schema.common.ObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import fr.sncf.osrd.utils.graph.EdgeDirection;

public class SingleDirectionalRJSTrackRange extends RJSTrackRange {
    public EdgeDirection direction;

    SingleDirectionalRJSTrackRange(ObjectRef<RJSTrackSection> track,
                             EdgeDirection direction, double begin, double end) {
        super(track, begin, end);
        this.direction = direction;
    }

    @Override
    public ApplicableDirection getNavigability() {
        if (direction == EdgeDirection.START_TO_STOP)
            return ApplicableDirection.NORMAL;
        return ApplicableDirection.REVERSE;
    }
}
