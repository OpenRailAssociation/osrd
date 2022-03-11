package fr.sncf.osrd.new_infra.api.tracks.undirected;

import fr.sncf.osrd.new_infra.api.WithAttributes;
import fr.sncf.osrd.utils.attrs.Attr;
import java.util.List;

/** An undirected track edge, which can either be a branch of a switch, or a track section */
public sealed interface TrackEdge extends WithAttributes permits SwitchBranch, TrackSection {
    /** The physical length of the edge, in meters */
    double getLength();

    /** List of objects on the track */
    Attr<List<TrackObject>> TRACK_OBJECTS = new Attr<>();

    /** Global unique index starting at 0, used for union finds */
    Attr<Integer> INDEX = new Attr<>();
}
