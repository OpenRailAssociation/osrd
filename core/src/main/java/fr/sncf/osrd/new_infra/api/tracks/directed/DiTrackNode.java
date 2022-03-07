package fr.sncf.osrd.new_infra.api.tracks.directed;

import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackNode;

/**
 * Nodes are points where two pieces of tracks connect.
 * These points bear little to no information, except maybe
 * how the pieces of track were linked in the first place.
 */
public record DiTrackNode(TrackNode node, Direction direction) {
}
