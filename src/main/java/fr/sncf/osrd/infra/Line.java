package fr.sncf.osrd.infra;

import java.util.ArrayList;

public class Line {
    public final String name;
    public final ArrayList<Track> tracks = new ArrayList<>();

    public Line(String name) {
        this.name = name;
    }
}
