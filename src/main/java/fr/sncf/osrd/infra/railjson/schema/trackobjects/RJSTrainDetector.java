package fr.sncf.osrd.infra.railjson.schema.trackobjects;

import fr.sncf.osrd.infra.railjson.schema.Identified;

public class RJSTrainDetector extends BiDirectionalRJSTrackObject implements Identified {
    public final String id;

    public RJSTrainDetector(String id, double position) {
        super(position);
        this.id = id;
    }

    @Override
    public String getID() {
        return id;
    }
}
