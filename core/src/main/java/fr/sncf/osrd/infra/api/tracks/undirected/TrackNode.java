package fr.sncf.osrd.infra.api.tracks.undirected;

/** A node on the undirected track graph */
public sealed interface TrackNode permits SwitchPort, TrackNode.End, TrackNode.Joint {
    /** A joint links two track sections together */
    non-sealed interface Joint extends TrackNode {
        String getID();
    }

    /** Terminates an unconnected end of a track section */
    non-sealed interface End extends TrackNode {
    }
}
