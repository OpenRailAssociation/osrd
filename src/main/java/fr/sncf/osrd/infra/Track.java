package fr.sncf.osrd.infra;

public class Track {
    public final Line line;
    public final String name;

    private Track(Line line, String name) {
        this.line = line;
        this.name = name;
    }

    /**
     * Creates a track and registers it with a line.
     * @throws DataIntegrityException when another track with the same name is already registered.
     */
    public static Track createAndRegister(Line line, String trackName) throws DataIntegrityException {
        var track = new Track(line, trackName);
        line.register(track);
        return track;
    }


    public final StairSequence<Double> slope = new StairSequence<>();
    public final StairSequence<BlockSection> blockSections = new StairSequence<>();
    public final StairSequence<Double> speedLimit = new StairSequence<>();
}
