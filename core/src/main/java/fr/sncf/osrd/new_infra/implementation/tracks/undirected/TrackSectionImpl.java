package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.new_infra.implementation.BaseAttributes;

public class TrackSectionImpl extends BaseAttributes implements TrackSection {

    private final double length;
    private final String id;

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
}
