package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

public class InfraTrackSection implements fr.sncf.osrd.new_infra.api.tracks.undirected.TrackSection {
    public final double length;
    public final String id;

    public InfraTrackSection(double length, String id) {
        this.length = length;
        this.id = id;
    }

    @Override
    public double getLength() {
        return length;
    }

    @Override
    public String toString() {
        return id;
    }
}
