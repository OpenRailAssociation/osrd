package fr.sncf.osrd.new_infra.api.tracks.undirected;

/** An undirected track edge, which can either be a branch of a switch, or a track section */
public sealed interface TrackEdge permits SwitchBranch, TrackSection {
    /** The physical length of the edge, in meters */
    double getLength();
}
