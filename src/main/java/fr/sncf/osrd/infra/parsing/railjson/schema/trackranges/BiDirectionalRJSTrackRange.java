package fr.sncf.osrd.infra.parsing.railjson.schema.trackranges;

import fr.sncf.osrd.infra.parsing.railjson.schema.ApplicableDirections;

public class BiDirectionalRJSTrackRange extends RJSTrackRange {
    BiDirectionalRJSTrackRange(double start, double end) {
        super(start, end);
    }

    @Override
    ApplicableDirections getNavigability() {
        return ApplicableDirections.BOTH;
    }
}
