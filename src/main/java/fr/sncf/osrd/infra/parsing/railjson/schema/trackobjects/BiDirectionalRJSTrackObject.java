package fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects;

import fr.sncf.osrd.infra.parsing.railjson.schema.ApplicableDirections;

public class BiDirectionalRJSTrackObject extends RJSTrackObject {
    BiDirectionalRJSTrackObject(double position) {
        super(position);
    }

    @Override
    ApplicableDirections getNavigability() {
        return ApplicableDirections.BOTH;
    }
}
