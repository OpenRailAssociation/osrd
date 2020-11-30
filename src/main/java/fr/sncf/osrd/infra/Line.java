package fr.sncf.osrd.infra;

import fr.sncf.osrd.util.CryoMap;
import fr.sncf.osrd.util.Freezable;

public class Line implements Freezable {
    public final String name;
    public final String id;
    private final CryoMap<String, Track> tracks = new CryoMap<>();

    /**
     * Creates a new line.
     * @param name The display name for this line
     * @param id The unique identifier for this line
     */
    public Line(String name, String id)  {
        this.name = name;
        this.id = id;
    }

    /**
     * Add a {@link Track} to the line.
     * @throws InvalidInfraException If a track with the same name is already registered
     */
    void register(Track track) throws InvalidInfraException {
        if (track.line != this)
            throw new InvalidInfraException("registering a track to the wrong line");

        if (tracks.putIfAbsent(track.name, track) != null) {
            var message = String.format("duplicate track name '%s' in line '%s'", name, track.name);
            throw new InvalidInfraException(message);
        }
    }

    @Override
    public void freeze() {
        tracks.freeze();
    }
}
