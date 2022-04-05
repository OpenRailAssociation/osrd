package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.tracks.undirected.Detector;
import fr.sncf.osrd.new_infra.api.tracks.undirected.OperationalPoint;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.utils.DoubleRangeMap;
import fr.sncf.osrd.utils.geom.LineString;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.EnumMap;

public class TrackSectionImpl implements TrackSection {

    private final double length;
    private final String id;
    private final ImmutableSet<OperationalPoint> operationalPoints;
    EnumMap<Direction, DoubleRangeMap> speedSections;
    EnumMap<Direction, DoubleRangeMap> gradients;
    ImmutableList<Detector> detectors = ImmutableList.of();
    int index;
    private final LineString geo;
    private final LineString sch;

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("length", length)
                .add("id", id)
                .toString();
    }

    /** Constructor */
    public TrackSectionImpl(
            double length,
            String id,
            ImmutableSet<OperationalPoint> operationalPoints,
            LineString geo,
            LineString sch
    ) {
        this.length = length;
        this.id = id;
        this.operationalPoints = operationalPoints;
        this.geo = geo;
        this.sch = sch;
    }

    /** Constructor with empty operational points and geometry */
    public TrackSectionImpl(double length, String id) {
        this.length = length;
        this.id = id;
        this.geo = null;
        this.sch = null;
        this.operationalPoints = ImmutableSet.of();
    }

    @Override
    public double getLength() {
        return length;
    }

    @Override
    public ImmutableList<Detector> getDetectors() {
        return detectors;
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
    public ImmutableSet<OperationalPoint> getOperationalPoints() {
        return operationalPoints;
    }

    @Override
    public String getID() {
        return id;
    }

    @Override
    public LineString getGeo() {
        return geo;
    }

    @Override
    public LineString getSch() {
        return sch;
    }
}
