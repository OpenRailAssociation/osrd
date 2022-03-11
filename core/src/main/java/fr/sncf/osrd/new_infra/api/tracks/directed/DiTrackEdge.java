package fr.sncf.osrd.new_infra.api.tracks.directed;

import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.WithAttributes;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackEdge;
import fr.sncf.osrd.utils.attrs.Attr;
import java.util.List;

/** A direction on a track edge, which can either be a branch of a switch, or a track section */
public interface DiTrackEdge extends WithAttributes {

    TrackEdge getEdge();

    Direction getDirection();

    /** List of objects on the track, following the DiTrackEdge direction.
     * Objects with position=0 are at the start of the oriented edge */
    Attr<List<DiTrackObject>> ORIENTED_TRACK_OBJECTS = new Attr<>();
}

