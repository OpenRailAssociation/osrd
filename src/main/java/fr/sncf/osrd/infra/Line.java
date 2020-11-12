package fr.sncf.osrd.infra;

import java.util.ArrayList;

public class Line {
    final public String name;
    final public ArrayList<Track> tracks = new ArrayList<>();

    public Line(String name) {
        this.name = name;
    }
}
