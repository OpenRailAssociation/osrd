package fr.sncf.osrd.infra.trackgraph;

public class Detector extends Waypoint {
    public Detector(int index, String id) {
        super(index, id);
    }

    @Override
    public String toString() {
        return String.format("Detector { id=%s }", id);
    }
}
