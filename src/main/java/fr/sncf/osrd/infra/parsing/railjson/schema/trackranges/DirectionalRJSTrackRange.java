package fr.sncf.osrd.infra.parsing.railjson.schema.trackranges;

import fr.sncf.osrd.infra.parsing.railjson.schema.Navigability;

public class DirectionalRJSTrackRange extends RJSTrackRange {
    public final Navigability navigability;

    DirectionalRJSTrackRange(Navigability navigability, double start, double end) {
        super(start, end);
        this.navigability = navigability;
    }

    @Override
    Navigability getNavigability() {
        return navigability;
    }
}
