package fr.sncf.osrd.new_infra.implementation.tracks.directed;

import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackEdge;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackEdge;
import fr.sncf.osrd.new_infra.implementation.BaseAttributes;

public class DiTrackEdgeImpl extends BaseAttributes implements DiTrackEdge {
    private final TrackEdge edge;
    private final Direction direction;

    public DiTrackEdgeImpl(TrackEdge edge, Direction direction) {
        this.edge = edge;
        this.direction = direction;
    }

    @Override
    public TrackEdge getEdge() {
        return edge;
    }

    @Override
    public Direction getDirection() {
        return direction;
    }
}
