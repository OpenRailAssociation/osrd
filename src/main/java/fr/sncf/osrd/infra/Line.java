package fr.sncf.osrd.infra;

import fr.sncf.osrd.util.CryoMap;
import fr.sncf.osrd.util.Freezable;

public class Line implements Freezable {
    public final String name;
    public final String id;
    private final CryoMap<String, Track> tracks = new CryoMap<>();

    /**
     * Creates a new line.
     * @param name The unique identified for the line.
     */
    public Line(String name, String id)  {
        this.name = name;
        this.id = id;
    }

    /**
     * Add a {@link fr.sncf.osrd.infra.Track} to the line.
     * @throws DataIntegrityException If a track with the same name is already registered
     */
    void register(Track track) throws DataIntegrityException {
        if (track.line != this)
            throw new DataIntegrityException("registering a track to the wrong line");

        if (tracks.putIfAbsent(track.name, track) != null) {
            var message = String.format("duplicate track name '%s' in line '%s'", name, track.name);
            throw new DataIntegrityException(message);
        }
    }

    @Override
    public void freeze() {
        tracks.freeze();
    }
}
