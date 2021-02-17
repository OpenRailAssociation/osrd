package fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects;

import fr.sncf.osrd.infra.graph.ApplicableDirections;

public class BiDirectionalRJSTrackObject extends RJSTrackObject {
    BiDirectionalRJSTrackObject(double position) {
        super(position);
    }

    @Override
    public ApplicableDirections getNavigability() {
        return ApplicableDirections.BOTH;
    }
}
