package fr.sncf.osrd.infra.parsing.railjson.schema.trackranges;

import fr.sncf.osrd.infra.parsing.railjson.schema.Navigability;

public class DirectionalTrackRange extends TrackRange {
    public final Navigability navigability;

    DirectionalTrackRange(Navigability navigability, double start, double end) {
        super(start, end);
        this.navigability = navigability;
    }

    @Override
    Navigability getNavigability() {
        return navigability;
    }
}
