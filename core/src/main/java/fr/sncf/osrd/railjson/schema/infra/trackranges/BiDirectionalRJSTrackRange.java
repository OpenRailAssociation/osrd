package fr.sncf.osrd.railjson.schema.infra.trackranges;

import fr.sncf.osrd.utils.graph.ApplicableDirection;

public class BiDirectionalRJSTrackRange extends RJSTrackRange {
    BiDirectionalRJSTrackRange(double start, double end) {
        super(start, end);
    }

    @Override
    public ApplicableDirection getNavigability() {
        return ApplicableDirection.BOTH;
    }
}
