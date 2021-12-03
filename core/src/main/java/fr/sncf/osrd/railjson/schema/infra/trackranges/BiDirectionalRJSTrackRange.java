package fr.sncf.osrd.railjson.schema.infra.trackranges;

import fr.sncf.osrd.railjson.schema.common.ObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.utils.graph.ApplicableDirection;

public class BiDirectionalRJSTrackRange extends RJSTrackRange {
    BiDirectionalRJSTrackRange(ObjectRef<RJSTrackSection> track, double start, double end) {
        super(track, start, end);
    }

    @Override
    public ApplicableDirection getNavigability() {
        return ApplicableDirection.BOTH;
    }
}
