package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableList;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackObject;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.utils.DoubleRangeMap;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.EnumMap;

public class TrackSectionImpl implements TrackSection {

    private final double length;
    private final String id;
    EnumMap<Direction, DoubleRangeMap> speedSections;
    EnumMap<Direction, DoubleRangeMap> gradients;
    ImmutableList<TrackObject> trackObjects;
    int index;

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("length", length)
                .add("id", id)
                .toString();
    }

    public TrackSectionImpl(double length, String id) {
        this.length = length;
        this.id = id;
    }

    @Override
    public double getLength() {
        return length;
    }

    @Override
    public ImmutableList<TrackObject> getTrackObjects() {
        return trackObjects;
    }

    @Override
    public EnumMap<Direction, DoubleRangeMap> getGradients() {
        return gradients;
    }

    @Override
    public EnumMap<Direction, DoubleRangeMap> getSpeedSections() {
        return speedSections;
    }

    @Override
    public int getIndex() {
        return index;
    }

    @Override
    public String getID() {
        return id;
    }
}
