package fr.sncf.osrd.new_infra.implementation.tracks.directed;

import com.google.common.base.MoreObjects;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackEdge;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackEdge;
import fr.sncf.osrd.utils.attrs.MutableAttrMap;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

public class DiTrackEdgeImpl implements DiTrackEdge {
    private final TrackEdge edge;
    private final Direction direction;
    private final MutableAttrMap<Object> attrs = new MutableAttrMap<>();

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("edge", edge)
                .add("direction", direction)
                .add("attrs", attrs)
                .toString();
    }

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

    @Override
    public MutableAttrMap<Object> getAttrs() {
        return attrs;
    }
}
