package fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects;

import fr.sncf.osrd.infra.parsing.railjson.schema.Navigability;

public class BiDirectionalTrackObject extends TrackObject {
    BiDirectionalTrackObject(double position) {
        super(position);
    }

    @Override
    Navigability getNavigability() {
        return Navigability.BOTH;
    }
}
