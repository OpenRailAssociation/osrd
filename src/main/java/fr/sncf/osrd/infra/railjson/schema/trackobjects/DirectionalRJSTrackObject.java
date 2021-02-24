package fr.sncf.osrd.infra.railjson.schema.trackobjects;

import fr.sncf.osrd.utils.graph.ApplicableDirections;

public class DirectionalRJSTrackObject extends RJSTrackObject {
    public final ApplicableDirections applicableDirections;

    DirectionalRJSTrackObject(ApplicableDirections applicableDirections, double position) {
        super(position);
        this.applicableDirections = applicableDirections;
    }

    @Override
    public ApplicableDirections getNavigability() {
        return applicableDirections;
    }
}
