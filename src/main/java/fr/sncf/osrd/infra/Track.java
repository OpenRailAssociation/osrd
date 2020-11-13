package fr.sncf.osrd.infra;

public class Track {
    public final Line line;
    public final String name;

    public Track(Line line, String name) {
        this.line = line;
        this.name = name;
    }

    public final StairSequence<Double> slope = new StairSequence<>();
    public final StairSequence<BlockSection> blockSections = new StairSequence<>();
    public final StairSequence<Double> speedLimit = new StairSequence<>();
}
