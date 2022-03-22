package fr.sncf.osrd.new_infra.api.tracks.undirected;

import com.google.common.collect.ImmutableList;

/** An undirected track edge, which can either be a branch of a switch, or a track section */
public sealed interface TrackEdge permits SwitchBranch, TrackSection {
    /** The physical length of the edge, in meters */
    double getLength();

    /** List of objects on the track */
    ImmutableList<TrackObject> getTrackObjects();

    /** Global unique index starting at 0, used for union finds */
    int getIndex();
}
