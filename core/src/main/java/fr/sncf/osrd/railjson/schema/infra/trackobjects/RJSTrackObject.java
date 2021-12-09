package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;

/** An object on a RJSTrackSection. It's meant to be referenced from the section itself. */
public abstract class RJSTrackObject {
    /** Position from the beginning of the RJSTrackSection */
    public double position;

    public RJSObjectRef<RJSTrackSection> track;

    public RJSTrackObject(RJSObjectRef<RJSTrackSection> track, double position) {
        this.track = track;
        this.position = position;
    }
}
