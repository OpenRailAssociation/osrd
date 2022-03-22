package fr.sncf.osrd.new_infra.api.tracks.undirected;

/** An object located on a track section */
public interface TrackObject {
    /** Returns the track section this object is on */
    TrackSection getTrackSection();

    /** Returns the offset of the object inside the track section */
    double getOffset();

    /** Returns the ID of the object */
    String getID();

    /** Returns the type of the object */
    TrackObjectType getType();

    enum TrackObjectType {
        DETECTOR,
        BUFFER_STOP
    }
}
