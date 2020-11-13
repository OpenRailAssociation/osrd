package fr.sncf.osrd.infra;

public class Track {
    public final Line line;
    public final String name;

    public Track(Line line, String name) {
        this.line = line;
        this.name = name;
    }
}
