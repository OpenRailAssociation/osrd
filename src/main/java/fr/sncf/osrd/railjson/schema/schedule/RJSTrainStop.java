package fr.sncf.osrd.railjson.schema.schedule;

import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;

/** This class represents a stop on the train path */
public class RJSTrainStop {

    /** Stop position on the track, as a distance to the path start
     * One must be specified between position and location */
    public Double position;

    /** Stop location, as a position on a track
     * One must be specified between position and location */
    public RJSTrackLocation location;

    /** Stop duration */
    public double duration;
}
