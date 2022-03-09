package fr.sncf.osrd.new_infra.api.tracks.undirected;

/** An object located on a track section */
public interface TrackObject {
    /** Returns the track section this object is on */
    TrackSection getTrackSection();

    /** Return the offset of the object inside the track section */
    double getOffset();
}
