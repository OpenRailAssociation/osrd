package fr.sncf.osrd.new_infra.api.tracks.undirected;

import fr.sncf.osrd.new_infra.api.WithAttributes;

/** A node on the undirected track graph */
public sealed interface TrackNode extends WithAttributes permits SwitchPort, TrackNode.End, TrackNode.Joint {
    /** A joint links two track sections together */
    non-sealed interface Joint extends TrackNode {
    }

    /** Terminates an unconnected end of a track section */
    non-sealed interface End extends TrackNode {
    }
}
