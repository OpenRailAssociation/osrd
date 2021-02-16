package fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects;

import fr.sncf.osrd.infra.parsing.railjson.schema.Navigability;

public class BiDirectionalRJSTrackObject extends RJSTrackObject {
    BiDirectionalRJSTrackObject(double position) {
        super(position);
    }

    @Override
    Navigability getNavigability() {
        return Navigability.BOTH;
    }
}
