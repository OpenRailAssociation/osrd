package fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects;

import fr.sncf.osrd.util.graph.ApplicableDirections;
import fr.sncf.osrd.infra.parsing.railjson.schema.Identified;

public class RJSTrainDetector extends DirectionalRJSTrackObject implements Identified {
    public final String id;

    public RJSTrainDetector(String id, ApplicableDirections applicableDirections, double position) {
        super(applicableDirections, position);
        this.id = id;
    }

    @Override
    public String getID() {
        return id;
    }
}
