package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.blocksection.BlockSection;
import fr.sncf.osrd.util.Indexable;
import fr.sncf.osrd.util.StairSequence;

public class Track implements Indexable {
    public final Line line;
    public final String id;
    public final String name;

    private Track(Line line, String id, String name) {
        this.line = line;
        this.id = id;
        this.name = name;
    }

    /**
     * Creates a track and registers it with a line.
     * @param line the line this track belongs to
     * @param id the unique identified for this track
     * @param name the display name for this track
     * @return the newly created track
     * @throws InvalidInfraException when another track with the same name is already registered.
     */
    public static Track createAndRegister(Line line, String id, String name) throws InvalidInfraException {
        var track = new Track(line, id, name);
        line.register(track);
        return track;
    }

    public final TrackAttributes attributes = new TrackAttributes();

    /**
     * A per-line unique track index.
     * It doesn't reflect any special order, it's just unique per line!
     */
    private int index = -1;

    @Override
    public void setIndex(int index) {
        assert this.index == -1;
        this.index = index;
    }

    @Override
    public int getIndex() {
        assert index != -1;
        return index;
    }
}
