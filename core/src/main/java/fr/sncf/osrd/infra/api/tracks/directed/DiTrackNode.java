package fr.sncf.osrd.infra.api.tracks.directed;

import fr.sncf.osrd.infra.api.tracks.undirected.TrackNode;

/**
 * Nodes are points where two pieces of tracks connect.
 * These points bear little to no information, except maybe
 * how the pieces of track were linked in the first place.
 * Each TrackNode has two DiTrackNode, one for each direction.
 */
public record DiTrackNode(TrackNode node, Side direction) {
    /** This is a binary enum where values are arbitrary and carry no information */
    public enum Side {
        A,
        B
    }
}
