package fr.sncf.osrd.new_infra.api.tracks.directed;

import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackObject;

public record DiTrackObject(TrackObject object, double offset, Direction direction) {
}
