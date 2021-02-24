package fr.sncf.osrd.infra.railjson.schema.trackobjects;

import fr.sncf.osrd.utils.graph.ApplicableDirections;

public class BiDirectionalRJSTrackObject extends RJSTrackObject {
    BiDirectionalRJSTrackObject(double position) {
        super(position);
    }

    @Override
    public ApplicableDirections getNavigability() {
        return ApplicableDirections.BOTH;
    }
}
