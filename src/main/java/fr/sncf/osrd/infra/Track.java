package fr.sncf.osrd.infra;

import java.util.ArrayList;

public class Track {
    public final String name;
    public final ArrayList<TopoEdge> edges = new ArrayList<>();

    public Track(String name) {
        this.name = name;
    }
}
