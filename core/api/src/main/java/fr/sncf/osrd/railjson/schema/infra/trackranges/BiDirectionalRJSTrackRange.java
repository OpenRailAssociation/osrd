package fr.sncf.osrd.railjson.schema.infra.trackranges;

import fr.sncf.osrd.railjson.schema.common.RJSApplicableDirection;

public class BiDirectionalRJSTrackRange extends RJSTrackRange {
    BiDirectionalRJSTrackRange(double begin, double end) {
        this.begin = begin;
        this.end = end;
    }

    @Override
    public RJSApplicableDirection getNavigability() {
        return RJSApplicableDirection.BOTH;
    }
}
