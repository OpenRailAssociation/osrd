package fr.sncf.osrd.railjson.infra.trackobjects;

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
