package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackObject;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.new_infra.implementation.BaseAttributes;

public class TrackObjectImpl extends BaseAttributes implements TrackObject {

    /** Track section the object is placed on */
    public final TrackSection trackSection;
    /** Offset on the track section */
    public final double offset;
    /** Type of the object (detector or buffer stop) */
    public final TrackObjectType type;
    /** ID of the object */
    public final String id;

    /** Constructor */
    public TrackObjectImpl(TrackSection trackSection, double offset, TrackObjectType type, String id) {
        this.trackSection = trackSection;
        this.offset = offset;
        this.type = type;
        this.id = id;
    }

    @Override
    public TrackSection getTrackSection() {
        return trackSection;
    }

    @Override
    public double getOffset() {
        return offset;
    }

    @Override
    public String getID() {
        return id;
    }

    @Override
    public TrackObjectType getType() {
        return type;
    }
}
