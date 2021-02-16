package fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects;

import fr.sncf.osrd.infra.parsing.railjson.schema.Navigability;

public class DirectionalRJSTrackObject extends RJSTrackObject {
    public final Navigability navigability;

    DirectionalRJSTrackObject(Navigability navigability, double position) {
        super(position);
        this.navigability = navigability;
    }

    @Override
    Navigability getNavigability() {
        return navigability;
    }
}
