package fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects;

import fr.sncf.osrd.infra.parsing.railjson.schema.ApplicableDirections;

public class DirectionalRJSTrackObject extends RJSTrackObject {
    public final ApplicableDirections applicableDirections;

    DirectionalRJSTrackObject(ApplicableDirections applicableDirections, double position) {
        super(position);
        this.applicableDirections = applicableDirections;
    }

    @Override
    ApplicableDirections getNavigability() {
        return applicableDirections;
    }
}
