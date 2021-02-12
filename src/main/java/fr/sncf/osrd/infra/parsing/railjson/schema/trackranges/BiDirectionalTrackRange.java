package fr.sncf.osrd.infra.parsing.railjson.schema.trackranges;

import fr.sncf.osrd.infra.parsing.railjson.schema.Navigability;

public class BiDirectionalTrackRange extends TrackRange {
    BiDirectionalTrackRange(double start, double end) {
        super(start, end);
    }

    @Override
    Navigability getNavigability() {
        return Navigability.BOTH;
    }
}
