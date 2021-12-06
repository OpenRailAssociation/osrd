package fr.sncf.osrd.railjson.schema.infra.trackranges;

import fr.sncf.osrd.railjson.schema.common.ObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import fr.sncf.osrd.utils.graph.EdgeDirection;

public class SingleDirectionalRJSTrackRange extends RJSTrackRange {
    public EdgeDirection direction;
    public ObjectRef<RJSTrackSection> track;

    SingleDirectionalRJSTrackRange(ObjectRef<RJSTrackSection> track,
                             EdgeDirection direction, double begin, double end) {
        super(begin, end);
        this.track = track;
        this.direction = direction;
    }

    @Override
    public ApplicableDirection getNavigability() {
        if (direction == EdgeDirection.START_TO_STOP)
            return ApplicableDirection.NORMAL;
        return ApplicableDirection.REVERSE;
    }
}
