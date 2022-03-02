package fr.sncf.osrd.railjson.schema.infra.trackranges;

import fr.sncf.osrd.utils.graph.ApplicableDirection;

public class RJSBiDirectionalTrackRange extends RJSTrackRange {
    RJSBiDirectionalTrackRange(double begin, double end) {
        this.begin = begin;
        this.end = end;
    }

    @Override
    public ApplicableDirection getNavigability() {
        return ApplicableDirection.BOTH;
    }
}
