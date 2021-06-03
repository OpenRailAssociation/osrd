package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import fr.sncf.osrd.utils.graph.ApplicableDirection;

public class BiDirectionalRJSTrackObject extends RJSTrackObject {
    protected BiDirectionalRJSTrackObject(double position) {
        super(position);
    }

    @Override
    public ApplicableDirection getApplicableDirection() {
        return ApplicableDirection.BOTH;
    }
}
