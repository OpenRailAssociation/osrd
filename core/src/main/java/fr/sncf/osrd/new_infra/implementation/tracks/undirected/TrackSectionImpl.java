package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import com.google.common.base.MoreObjects;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.utils.attrs.MutableAttrMap;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

public class TrackSectionImpl implements TrackSection {

    private final double length;
    private final String id;
    private final MutableAttrMap<Object> attrs = new MutableAttrMap<>();

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("length", length)
                .add("id", id)
                .add("attrs", attrs)
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
    public String getID() {
        return id;
    }

    @Override
    public MutableAttrMap<Object> getAttrs() {
        return attrs;
    }
}
