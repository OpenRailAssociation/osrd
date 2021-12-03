package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import fr.sncf.osrd.railjson.schema.common.ObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;

/** An object on a RJSTrackSection. It's meant to be referenced from the section itself. */
public abstract class RJSTrackObject {
    /** Position from the beginning of the RJSTrackSection */
    public double position;

    public ObjectRef<RJSTrackSection> track;

    public RJSTrackObject(ObjectRef<RJSTrackSection> track, double position) {
        this.track = track;
        this.position = position;
    }
}
