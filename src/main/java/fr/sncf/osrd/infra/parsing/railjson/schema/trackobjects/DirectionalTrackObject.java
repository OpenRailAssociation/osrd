package fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects;

import fr.sncf.osrd.infra.parsing.railjson.schema.Navigability;

public class DirectionalTrackObject extends TrackObject {
    public final Navigability navigability;

    DirectionalTrackObject(Navigability navigability, double position) {
        super(position);
        this.navigability = navigability;
    }

    @Override
    Navigability getNavigability() {
        return navigability;
    }
}
