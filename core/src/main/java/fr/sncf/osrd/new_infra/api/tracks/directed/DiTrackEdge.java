package fr.sncf.osrd.new_infra.api.tracks.directed;

import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackEdge;

/** A direction on a track edge, which can either be a branch of a switch, or a track section */
public record DiTrackEdge(TrackEdge edge, Direction direction) {
}

